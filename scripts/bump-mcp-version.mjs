import fs from "node:fs/promises";
import path from "node:path";

const SERVER_JSON_PATH = path.join(import.meta.dirname, "..", "server.json");

const response = await fetch("https://mcp.sanity.io", {
  method: "POST",
  headers: { authorization: "Bearer sk_dummy", accept: "application/json; text/event-stream", "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: {
        name: "sanity-io/agent-toolkit version checker",
        version: "1.0.0",
      },
    },
  }),
});

const body = await response.json();

const mcpServerVersion = body.result.serverInfo.version;

const serverJsonContent = await fs.readFile(SERVER_JSON_PATH, "utf-8");

const updatedJsonContent = serverJsonContent.replace(/"version": ".+",$/m, `"version": "${mcpServerVersion}",`);

await fs.writeFile(SERVER_JSON_PATH, updatedJsonContent);

console.log(`Updated server.json with MCP server version: ${mcpServerVersion}`);
