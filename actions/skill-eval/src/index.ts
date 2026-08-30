import * as core from '@actions/core'
import * as github from '@actions/github'
import { discoverSkills, loadSkill, getChangedSkills, buildSystemPrompt } from './loader'
import { getModel, runSkillPrompt } from './runner'
import { gradeWithRetry } from './grader'
import { generateJobSummary, estimateCost } from './reporter'
import { createSanityClient, getBaseline, saveResults } from './baseline'
import type { SkillResult, EvalResult, BaselineEntry } from './types'

async function run(): Promise<void> {
  try {
    // Read inputs
    const provider = core.getInput('provider') || 'anthropic'
    const apiKey = core.getInput('api-key', { required: true })
    const modelId = core.getInput('model') || 'claude-sonnet-4-20250514'
    const graderModelId = core.getInput('grader-model') || modelId
    const sanityToken = core.getInput('sanity-token')
    const sanityProjectId = core.getInput('sanity-project-id')
    const sanityDataset = core.getInput('sanity-dataset') || 'skill-evals'
    const skillsPath = core.getInput('skills-path') || './skills'
    const passThreshold = parseFloat(core.getInput('pass-threshold') || '0.8')
    const failOnRegression = core.getInput('fail-on-regression') !== 'false'
    const maxEvalsPerSkill = parseInt(core.getInput('max-evals-per-skill') || '20', 10)
    const changedOnly = core.getInput('changed-only') !== 'false'

    // Initialize models
    const model = getModel(provider, apiKey, modelId)
    const graderModel = getModel(provider, apiKey, graderModelId)

    // Discover skills
    core.info(`Discovering skills in ${skillsPath}...`)
    const allSkills = discoverSkills(skillsPath)
    core.info(`Found ${allSkills.length} skills: ${allSkills.join(', ')}`)

    // Filter to changed skills if in PR context
    let skillsToEval = allSkills
    if (changedOnly && github.context.eventName === 'pull_request') {
      skillsToEval = getChangedSkills(skillsPath, allSkills)
      core.info(`Changed skills: ${skillsToEval.length > 0 ? skillsToEval.join(', ') : '(none)'}`)
      
      if (skillsToEval.length === 0) {
        core.info('No skills changed in this PR. Skipping eval.')
        core.setOutput('pass-rate', '1.0')
        core.setOutput('summary', 'No skills changed — eval skipped.')
        core.setOutput('results-json', '[]')
        return
      }
    }

    // Load and eval each skill
    const allResults: SkillResult[] = []

    for (const skillName of skillsToEval) {
      core.info(`\n📋 Evaluating: ${skillName}`)
      const skill = loadSkill(skillsPath, skillName)

      if (skill.tests.length === 0) {
        core.warning(`  No test cases found for ${skillName} — skipping`)
        continue
      }

      const testsToRun = skill.tests.slice(0, maxEvalsPerSkill)
      core.info(`  Running ${testsToRun.length} test case(s)...`)

      const systemPrompt = buildSystemPrompt(skill)
      const evalResults: EvalResult[] = []
      let totalInputTokens = 0
      let totalOutputTokens = 0

      for (const testCase of testsToRun) {
        core.info(`  🔄 ${testCase.file}...`)
        const startTime = Date.now()

        try {
          // Step 1: Run the skill
          const userMessage = testCase.context
            ? `${testCase.prompt}\n\n---\nContext:\n${testCase.context}`
            : testCase.prompt

          const skillResponse = await runSkillPrompt(model, systemPrompt, userMessage)
          totalInputTokens += skillResponse.inputTokens
          totalOutputTokens += skillResponse.outputTokens

          // Step 2: Grade the response
          const grading = await gradeWithRetry(
            graderModel,
            skillResponse.text,
            testCase.expectations,
          )
          totalInputTokens += grading.inputTokens
          totalOutputTokens += grading.outputTokens

          const passedCount = grading.results.filter(r => r.passed).length
          const passRate = testCase.expectations.length > 0
            ? passedCount / testCase.expectations.length
            : 1

          const durationMs = Date.now() - startTime
          const icon = passRate >= 1 ? '✅' : passRate > 0 ? '⚠️' : '❌'
          core.info(`    ${icon} ${passedCount}/${testCase.expectations.length} expectations passed (${Math.round(passRate * 100)}%) — ${(durationMs / 1000).toFixed(1)}s`)

          evalResults.push({
            file: testCase.file,
            prompt: testCase.prompt,
            response: skillResponse.text,
            expectations: grading.results,
            passRate,
            durationMs,
            inputTokens: skillResponse.inputTokens + grading.inputTokens,
            outputTokens: skillResponse.outputTokens + grading.outputTokens,
          })
        } catch (err) {
          const durationMs = Date.now() - startTime
          core.error(`    ❌ Error: ${err instanceof Error ? err.message : String(err)}`)

          evalResults.push({
            file: testCase.file,
            prompt: testCase.prompt,
            response: `Error: ${err instanceof Error ? err.message : String(err)}`,
            expectations: testCase.expectations.map(e => ({
              text: e,
              passed: false,
              evidence: 'Eval failed with an error',
            })),
            passRate: 0,
            durationMs,
            inputTokens: 0,
            outputTokens: 0,
          })
        }
      }

      const passedTests = evalResults.filter(r => r.passRate >= 1).length
      const skillPassRate = evalResults.length > 0 ? passedTests / evalResults.length : 0
      const cost = estimateCost(provider, totalInputTokens, totalOutputTokens)

      core.info(`  📊 ${skill.name}: ${passedTests}/${evalResults.length} tests passed (${Math.round(skillPassRate * 100)}%) — est. $${cost.toFixed(3)}`)

      allResults.push({
        skill: skill.name,
        path: skill.path,
        results: evalResults,
        passRate: skillPassRate,
        totalTests: evalResults.length,
        passed: passedTests,
        failed: evalResults.length - passedTests,
        costEstimate: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          estimatedCostUsd: cost,
        },
      })
    }

    // Get baselines from Sanity (if configured)
    const baselines = new Map<string, BaselineEntry | null>()
    let sanityClient: ReturnType<typeof createSanityClient> | null = null

    if (sanityToken && sanityProjectId) {
      core.info('\n📦 Fetching baselines from Sanity...')
      sanityClient = createSanityClient(sanityToken, sanityProjectId, sanityDataset)

      for (const result of allResults) {
        const baseline = await getBaseline(sanityClient, result.skill, modelId, provider)
        baselines.set(result.skill, baseline)
        if (baseline) {
          core.info(`  ${result.skill}: baseline ${Math.round(baseline.passRate * 100)}% from ${baseline.commit.slice(0, 7)}`)
        }
      }
    }

    // Generate report
    const { markdown, regressions } = generateJobSummary(allResults, baselines, provider, modelId)
    await core.summary.addRaw(markdown).write()

    // Save results to Sanity (if configured and on default branch)
    const branch = github.context.ref?.replace('refs/heads/', '') || 'unknown'
    const commit = github.context.sha || 'unknown'

    if (sanityClient) {
      core.info('\n💾 Saving results to Sanity...')
      await saveResults(sanityClient, allResults, {
        commit,
        branch,
        model: modelId,
        provider,
      })
      core.info('  Results saved.')
    }

    // Set outputs
    const overallPassRate = allResults.length > 0
      ? allResults.reduce((sum, r) => sum + r.passed, 0) / allResults.reduce((sum, r) => sum + r.totalTests, 0)
      : 1

    core.setOutput('pass-rate', overallPassRate.toFixed(3))
    core.setOutput('results-json', JSON.stringify(allResults))
    core.setOutput('summary', `${Math.round(overallPassRate * 100)}% pass rate across ${allResults.length} skills`)

    // Check pass threshold
    if (overallPassRate < passThreshold) {
      core.setFailed(`Pass rate ${Math.round(overallPassRate * 100)}% is below threshold ${Math.round(passThreshold * 100)}%`)
      return
    }

    // Check regressions
    if (failOnRegression && regressions.length > 0) {
      core.setFailed(`${regressions.length} regression(s) detected: ${regressions.map(r => r.skill).join(', ')}`)
      return
    }

    core.info(`\n✅ All checks passed (${Math.round(overallPassRate * 100)}% pass rate)`)
  } catch (error) {
    core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

run()
