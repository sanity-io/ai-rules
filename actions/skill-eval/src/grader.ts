import { generateText } from 'ai'
import type { LanguageModelV1 } from 'ai'
import type { ExpectationResult } from './types'

const GRADER_SYSTEM = `You are a strict eval grader. For each expectation, determine if the response satisfies it.

Rules:
- Binary: pass or fail. No partial credit.
- The burden of proof is on passing — if unclear, fail.
- Quote specific evidence from the response.
- Be concise in your evidence — one sentence max.

Respond with JSON only (no markdown fences, no explanation):
{
  "results": [
    { "expectation": "...", "passed": true, "evidence": "..." }
  ]
}`

export async function gradeResponse(
  model: LanguageModelV1,
  response: string,
  expectations: string[],
): Promise<{ results: ExpectationResult[]; inputTokens: number; outputTokens: number }> {
  const userMessage = `Response to evaluate:
---
${response}
---

Expectations:
${expectations.map((e, i) => `${i + 1}. ${e}`).join('\n')}`

  const { text: gradingText, usage } = await generateText({
    model,
    system: GRADER_SYSTEM,
    prompt: userMessage,
  })

  const parsed = parseGradingResponse(gradingText, expectations)

  return {
    results: parsed,
    inputTokens: usage?.promptTokens ?? 0,
    outputTokens: usage?.completionTokens ?? 0,
  }
}

function parseGradingResponse(raw: string, expectations: string[]): ExpectationResult[] {
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/\`\`\`json\s*/g, '').replace(/\`\`\`\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)
    
    if (parsed.results && Array.isArray(parsed.results)) {
      return parsed.results.map((r: any, i: number) => ({
        text: r.expectation || expectations[i] || 'Unknown',
        passed: Boolean(r.passed),
        evidence: r.evidence || '',
      }))
    }
  } catch {
    // Parse failed
  }
  
  // Fallback: mark all as failed
  return expectations.map(e => ({
    text: e,
    passed: false,
    evidence: 'Grading response could not be parsed',
  }))
}

export async function gradeWithRetry(
  model: LanguageModelV1,
  response: string,
  expectations: string[],
): Promise<{ results: ExpectationResult[]; inputTokens: number; outputTokens: number }> {
  const first = await gradeResponse(model, response, expectations)
  
  // Check if parsing failed (all evidence = 'could not be parsed')
  const allFailed = first.results.every(r => r.evidence === 'Grading response could not be parsed')
  
  if (allFailed && expectations.length > 0) {
    // Retry once with tighter prompt
    const { text: retryText, usage: retryUsage } = await generateText({
      model,
      system: GRADER_SYSTEM + '\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation.',
      prompt: `Response to evaluate:
---
${response}
---

Expectations:
${expectations.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
    })
    
    const retryParsed = parseGradingResponse(retryText, expectations)
    
    return {
      results: retryParsed,
      inputTokens: first.inputTokens + (retryUsage?.promptTokens ?? 0),
      outputTokens: first.outputTokens + (retryUsage?.completionTokens ?? 0),
    }
  }
  
  return first
}
