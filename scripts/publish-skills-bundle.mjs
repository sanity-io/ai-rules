#!/usr/bin/env node

/**
 * Publishes skills-bundle.json (see build-skills-bundle.mjs) to a Sanity
 * dataset as a single document, so consumers can fetch the latest skills
 * from the Content Lake API without cloning the repo. Runs in CI on every
 * merge to main — see .github/workflows/ci.yml.
 *
 * Requires SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_WRITE_TOKEN.
 *
 * Usage: node scripts/publish-skills-bundle.mjs [bundle-path]
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET;
const token = process.env.SANITY_WRITE_TOKEN;

if (!projectId || !dataset || !token) {
  console.error("SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_WRITE_TOKEN must be set");
  process.exit(1);
}

const bundlePath = path.resolve(process.cwd(), process.argv[2] ?? "skills-bundle.json");
const bundle = JSON.parse(await fs.readFile(bundlePath, "utf8"));

const document = {
  _id: "skills-bundle",
  _type: "skillsBundle",
  version: bundle.version,
  commit: bundle.commit,
  generatedAt: bundle.generatedAt,
  skills: bundle.skills.map((skill) => ({
    _key: skill.name,
    name: skill.name,
    description: skill.description,
    content: skill.content,
    references: Object.entries(skill.references).map(([name, content]) => ({
      _key: name,
      name,
      content,
    })),
  })),
};

const response = await fetch(
  `https://${projectId}.api.sanity.io/v2025-02-19/data/mutate/${dataset}?visibility=sync`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mutations: [{ createOrReplace: document }] }),
  },
);

if (!response.ok) {
  console.error(`Publish failed with HTTP ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const result = await response.json();
console.log(
  `Published skills bundle (commit: ${bundle.commit}, transaction: ${result.transactionId})`,
);
