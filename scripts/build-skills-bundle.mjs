#!/usr/bin/env node

/**
 * Builds a single JSON bundle of all skills (SKILL.md + references) so
 * consumers can fetch them from one place. Published to a Sanity dataset on
 * every merge to main — see publish-skills-bundle.mjs and
 * .github/workflows/ci.yml.
 *
 * Usage: node scripts/build-skills-bundle.mjs [output-path]
 */

import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import matter from "gray-matter";

const repoRoot = process.cwd();
const skillsDir = path.join(repoRoot, "skills");
const outputPath = path.resolve(repoRoot, process.argv[2] ?? "skills-bundle.json");

const errors = [];

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getCommitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function loadSkill(skillDirName) {
  const skillMdPath = path.join(skillsDir, skillDirName, "SKILL.md");
  if (!(await pathExists(skillMdPath))) {
    return null;
  }

  const fileContent = await fs.readFile(skillMdPath, "utf8");
  const { data, content } = matter(fileContent);

  if (!data.name) {
    errors.push(`${skillDirName}/SKILL.md is missing "name" in frontmatter`);
    return null;
  }
  if (!data.description) {
    errors.push(`${skillDirName}/SKILL.md is missing "description" in frontmatter`);
    return null;
  }

  const references = {};
  const referencesDir = path.join(skillsDir, skillDirName, "references");
  if (await pathExists(referencesDir)) {
    const entries = await fs.readdir(referencesDir, { withFileTypes: true });
    for (const entry of entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name))) {
      const refContent = await fs.readFile(path.join(referencesDir, entry.name), "utf8");
      const refName = entry.name.replace(/\.[^.]+$/, "");
      if (refName in references) {
        errors.push(`${skillDirName}/references has duplicate reference name "${refName}"`);
      }
      references[refName] = refContent;
    }
  }

  return {
    name: data.name,
    description: data.description,
    content: content.trim(),
    references,
  };
}

/**
 * The references of sanity-best-practices double as standalone rules, so
 * each must carry a description in its frontmatter.
 */
function validateRules(skill) {
  for (const [name, markdown] of Object.entries(skill.references)) {
    const { data, content } = matter(markdown);
    if (!data.description || !String(data.description).trim()) {
      errors.push(`sanity-best-practices/references/${name}.md is missing "description" in frontmatter`);
    }
    if (!content.trim()) {
      errors.push(`sanity-best-practices/references/${name}.md has no content`);
    }
  }
}

const skillDirNames = (await fs.readdir(skillsDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const skills = [];
const seenNames = new Set();

for (const skillDirName of skillDirNames) {
  const skill = await loadSkill(skillDirName);
  if (!skill) continue;

  if (seenNames.has(skill.name)) {
    errors.push(`Duplicate skill name "${skill.name}" (from ${skillDirName})`);
    continue;
  }
  seenNames.add(skill.name);
  skills.push(skill);
}

const sanityBestPractices = skills.find((skill) => skill.name === "sanity-best-practices");
if (sanityBestPractices) {
  validateRules(sanityBestPractices);
} else {
  errors.push('Required skill "sanity-best-practices" not found');
}

if (errors.length > 0) {
  console.error("Skills bundle validation failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const bundle = {
  version: 1,
  commit: getCommitSha(),
  generatedAt: new Date().toISOString(),
  skills,
};

await fs.writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);
console.log(`Wrote ${skills.length} skills to ${path.relative(repoRoot, outputPath)}`);
