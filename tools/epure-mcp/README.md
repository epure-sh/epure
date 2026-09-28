# epure-mcp

Local stdio MCP server for Epure. Wraps the dashboard API with a PAT (`EPURE_URL` + `EPURE_TOKEN`).

**Full setup (MCP hosts, scopes, CLI, tools):** [epure.sh/docs/guides/mcp-and-cli](https://epure.sh/docs/guides/mcp-and-cli)

## Build

```bash
cd tools/epure-mcp
npm ci
npm run build
```

Run: `node dist/index.js` (requires `EPURE_TOKEN` in the environment).
