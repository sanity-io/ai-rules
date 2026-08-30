import * as core from '@actions/core'
import type { SkillResult, BaselineEntry } from './types'

interface RegressionInfo {
  skill: string
  currentRate: number
  baselineRate: number
  delta: number
  failedExpectations: Array<{ text: string; evidence: string }>
}

export function generateJobSummary(
  results: SkillResult[],
  baselines: Map<string, BaselineEntry | null>,
  provider: string,
  model: string,
): { markdown: string; regressions: RegressionInfo[] } {
  const regressions: RegressionInfo[] = []
  
  let md = `## 🧪 Skill Eval Results\n\n`
  md += `**Provider:** ${provider} | **Model:** ${model}\n\n`
  
  // Summary table
  md += `| Skill | Tests | Passed | Rate | Δ Baseline |\n`
  md += `|-------|-------|--------|------|------------|\n`
  
  let totalTests = 0
  let totalPassed = 0
  let totalCost = 0
  
  for (const result of results) {
    totalTests += result.totalTests
    totalPassed += result.passed
    totalCost += result.costEstimate.estimatedCostUsd
    
    const rate = `${Math.round(result.passRate * 100)}%`
    const baseline = baselines.get(result.skill)
    
    let deltaStr = '—'
    if (baseline) {
      const delta = result.passRate - baseline.passRate
      const deltaPercent = Math.round(delta * 100)
      if (deltaPercent > 0) {
        deltaStr = `+${deltaPercent}% ✅`
      } else if (deltaPercent < 0) {
        deltaStr = `${deltaPercent}% ⚠️`
        
        // Check for regression (>10% drop)
        if (delta < -0.1) {
          const failedExpectations = result.results
            .flatMap(r => r.expectations.filter(e => !e.passed))
            .map(e => ({ text: e.text, evidence: e.evidence }))
          
          regressions.push({
            skill: result.skill,
            currentRate: result.passRate,
            baselineRate: baseline.passRate,
            delta,
            failedExpectations,
          })
        }
      } else {
        deltaStr = '±0%'
      }
    }
    
    md += `| ${result.skill} | ${result.totalTests} | ${result.passed} | ${rate} | ${deltaStr} |\n`
  }
  
  const overallRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0
  md += `\n**Overall: ${overallRate}% (${totalPassed}/${totalTests})**`
  md += ` | Estimated cost: $${totalCost.toFixed(2)}\n`
  
  // Regressions section
  if (regressions.length > 0) {
    md += `\n### ⚠️ Regressions\n\n`
    for (const reg of regressions) {
      md += `- **${reg.skill}**: Pass rate dropped ${Math.round(Math.abs(reg.delta) * 100)}% `
      md += `(${Math.round(reg.baselineRate * 100)}% → ${Math.round(reg.currentRate * 100)}%)\n`
      for (const exp of reg.failedExpectations.slice(0, 5)) {
        md += `  - ❌ "${exp.text}" — ${exp.evidence}\n`
      }
    }
  }
  
  // Failed expectations details
  const failedResults = results.filter(r => r.passRate < 1)
  if (failedResults.length > 0) {
    md += `\n### Failed Expectations\n\n`
    for (const result of failedResults) {
      for (const evalResult of result.results) {
        const failures = evalResult.expectations.filter(e => !e.passed)
        if (failures.length === 0) continue
        
        md += `<details>\n`
        md += `<summary>${result.skill}: ${evalResult.file} (${failures.length} failure${failures.length !== 1 ? 's' : ''})</summary>\n\n`
        md += `**Prompt:** "${evalResult.prompt.length > 200 ? evalResult.prompt.slice(0, 200) + '…' : evalResult.prompt}"\n\n`
        
        for (const failure of failures) {
          md += `❌ **"${failure.text}"**\n`
          md += `> Evidence: ${failure.evidence}\n\n`
        }
        
        md += `</details>\n\n`
      }
    }
  }
  
  return { markdown: md, regressions }
}

export function estimateCost(
  provider: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Approximate pricing per million tokens (as of March 2026)
  const pricing: Record<string, { input: number; output: number }> = {
    'anthropic': { input: 3, output: 15 },      // Sonnet 4 pricing
    'openai': { input: 2.5, output: 10 },        // GPT-4o pricing
    'google': { input: 1.25, output: 5 },         // Gemini 1.5 Pro pricing
  }
  
  const rates = pricing[provider] || pricing['anthropic']
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000
}
