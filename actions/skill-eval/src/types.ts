export interface SkillFrontmatter {
  name: string
  description?: string
  version?: string
  [key: string]: unknown
}

export interface LoadedSkill {
  name: string
  path: string
  frontmatter: SkillFrontmatter
  content: string
  references: Array<{
    filename: string
    content: string
  }>
  tests: EvalTestCase[]
}

export interface EvalTestCase {
  file: string
  prompt: string
  context?: string
  expectations: string[]
  tags?: string[]
}

export interface ExpectationResult {
  text: string
  passed: boolean
  evidence: string
}

export interface EvalResult {
  file: string
  prompt: string
  response: string
  expectations: ExpectationResult[]
  passRate: number
  durationMs: number
  inputTokens: number
  outputTokens: number
}

export interface SkillResult {
  skill: string
  path: string
  results: EvalResult[]
  passRate: number
  totalTests: number
  passed: number
  failed: number
  costEstimate: CostEstimate
}

export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export interface BaselineEntry {
  skill: string
  passRate: number
  totalTests: number
  passed: number
  commit: string
  branch: string
  timestamp: string
  model: string
  provider: string
}
