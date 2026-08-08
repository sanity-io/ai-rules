#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";

const documents = [
  {
    path: "plugin.json",
    schemaUrl:
      "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  },
  {
    path: "mcp.json",
    schemaUrl: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  },
];

const ajv = new Ajv2020({ allErrors: true });
let valid = true;

for (const document of documents) {
  const [schemaResponse, data] = await Promise.all([
    fetch(document.schemaUrl),
    readFile(document.path, "utf8").then(JSON.parse),
  ]);

  if (!schemaResponse.ok) {
    throw new Error(
      `Unable to load ${document.schemaUrl}: ${schemaResponse.status} ${schemaResponse.statusText}`
    );
  }

  const validate = ajv.compile(await schemaResponse.json());
  if (!validate(data)) {
    valid = false;
    console.error(`${document.path} is invalid:`);
    console.error(ajv.errorsText(validate.errors, { separator: "\n" }));
  }
}

if (!valid) process.exit(1);

console.log("Agent Plugin manifests are valid.");
