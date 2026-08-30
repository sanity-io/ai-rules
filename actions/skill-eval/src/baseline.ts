import { createClient } from '@sanity/client'
import type { SkillResult, BaselineEntry } from './types'

export function createSanityClient(token: string, projectId: string, dataset: string) {
  return createClient({
    projectId,
    dataset,
    apiVersion: '2024-01-01',
    token,
    useCdn: false,
  })
}

export async function getBaseline(
  client: ReturnType<typeof createClient>,
  skillName: string,
  model: string,
  provider: string,
): Promise<BaselineEntry | null> {
  const result = await client.fetch(
    `*[_type == "skillEvalResult" && skill == $skill && branch == "main" && model == $model && provider == $provider] | order(timestamp desc) [0]`,
    { skill: skillName, model, provider },
  )
  return result || null
}

export async function saveResults(
  client: ReturnType<typeof createClient>,
  results: SkillResult[],
  metadata: {
    commit: string
    branch: string
    model: string
    provider: string
  },
): Promise<void> {
  const transaction = client.transaction()
  
  for (const result of results) {
    transaction.create({
      _type: 'skillEvalResult',
      skill: result.skill,
      commit: metadata.commit,
      branch: metadata.branch,
      provider: metadata.provider,
      model: metadata.model,
      timestamp: new Date().toISOString(),
      passRate: result.passRate,
      totalTests: result.totalTests,
      passed: result.passed,
      failed: result.failed,
      results: result.results.map(r => ({
        _key: Math.random().toString(36).slice(2, 10),
        file: r.file,
        prompt: r.prompt,
        response: r.response.slice(0, 2000), // Truncate for storage
        passRate: r.passRate,
        durationMs: r.durationMs,
        expectations: r.expectations.map(e => ({
          _key: Math.random().toString(36).slice(2, 10),
          text: e.text,
          passed: e.passed,
          evidence: e.evidence,
        })),
      })),
      costEstimate: {
        inputTokens: result.costEstimate.inputTokens,
        outputTokens: result.costEstimate.outputTokens,
        estimatedCostUsd: result.costEstimate.estimatedCostUsd,
      },
    })
  }
  
  await transaction.commit()
}
