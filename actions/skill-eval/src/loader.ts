import * as fs from 'fs'
import * as path from 'path'
import matter from 'gray-matter'
import { parse as parseYaml } from 'yaml'
import type { LoadedSkill, EvalTestCase, SkillFrontmatter } from './types'

export function discoverSkills(skillsPath: string): string[] {
  if (!fs.existsSync(skillsPath)) {
    return []
  }
  
  return fs.readdirSync(skillsPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .filter(d => fs.existsSync(path.join(skillsPath, d.name, 'SKILL.md')))
    .map(d => d.name)
}

export function loadSkill(skillsPath: string, skillName: string): LoadedSkill {
  const skillDir = path.join(skillsPath, skillName)
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  
  const raw = fs.readFileSync(skillMdPath, 'utf-8')
  const { data: frontmatter, content } = matter(raw)
  
  // Load references
  const refsDir = path.join(skillDir, 'references')
  const references: Array<{ filename: string; content: string }> = []
  
  if (fs.existsSync(refsDir)) {
    const refFiles = fs.readdirSync(refsDir).filter(f => !f.startsWith('.'))
    for (const refFile of refFiles) {
      references.push({
        filename: refFile,
        content: fs.readFileSync(path.join(refsDir, refFile), 'utf-8'),
      })
    }
  }
  
  // Load test cases
  const testsDir = path.join(skillDir, 'tests')
  const tests: EvalTestCase[] = []
  
  if (fs.existsSync(testsDir)) {
    const testFiles = fs.readdirSync(testsDir)
      .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
      .sort()
    
    for (const testFile of testFiles) {
      const testRaw = fs.readFileSync(path.join(testsDir, testFile), 'utf-8')
      const testData = parseYaml(testRaw)
      
      if (testData && testData.prompt && Array.isArray(testData.expectations)) {
        tests.push({
          file: testFile,
          prompt: testData.prompt,
          context: testData.context || undefined,
          expectations: testData.expectations,
          tags: testData.tags || undefined,
        })
      }
    }
  }
  
  return {
    name: (frontmatter as SkillFrontmatter).name || skillName,
    path: skillDir,
    frontmatter: frontmatter as SkillFrontmatter,
    content: content.trim(),
    references,
    tests,
  }
}

export function getChangedSkills(skillsPath: string, allSkills: string[]): string[] {
  // In a PR context, use git diff to find changed skills
  // Falls back to all skills if git diff fails
  try {
    const { execSync } = require('child_process')
    const baseBranch = process.env.GITHUB_BASE_REF || 'main'
    const diff = execSync(
      `git diff --name-only origin/${baseBranch}...HEAD -- ${skillsPath}/`,
      { encoding: 'utf-8' }
    ).trim()
    
    if (!diff) return []
    
    const changedPaths = diff.split('\n')
    const changedSkills = new Set<string>()
    
    for (const changedPath of changedPaths) {
      // Extract skill name from path like "skills/sanity-best-practices/references/schema.md"
      const relative = path.relative(skillsPath, changedPath)
      const skillName = relative.split(path.sep)[0]
      if (allSkills.includes(skillName)) {
        changedSkills.add(skillName)
      }
    }
    
    return Array.from(changedSkills)
  } catch {
    // If git diff fails (e.g., not in a PR), return all skills
    return allSkills
  }
}

export function buildSystemPrompt(skill: LoadedSkill): string {
  let prompt = `You are an AI assistant with the following skill activated:\n\n---\n${skill.content}\n---\n`
  
  if (skill.references.length > 0) {
    prompt += '\nReference files available:\n'
    for (const ref of skill.references) {
      prompt += `\n### ${ref.filename}\n${ref.content}\n`
    }
  }
  
  return prompt
}
