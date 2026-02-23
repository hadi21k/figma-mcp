# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build:all          # TypeScript compile + esbuild plugin bundle
npm run build              # TypeScript only (mcp-server + websocket-server → dist/)
npm run build:plugin       # esbuild only (figma-plugin/code.ts → code.js)
npm test                   # Run all tests (vitest)
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report (80% threshold on lines/funcs/branches/stmts)
npx vitest run tests/mcp-server/tools.test.ts  # Single test file
npm run socket             # Start WebSocket bridge (production)
npm run dev:socket         # Start bridge with auto-reload (tsx watch)
```

## Architecture

Three processes connected in a chain:

```
Claude ←stdio→ MCP Server ←WebSocket→ Bridge (127.0.0.1:9001) ←WebSocket→ Figma Plugin
```

**MCP Server** (`src/mcp-server/index.ts`): Uses `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` (not the deprecated `Server` class). Tools are registered via `server.registerTool()` which handles Zod→JSON Schema conversion and input validation internally. On tool call, sends a COMMAND over WebSocket to the bridge and awaits a RESPONSE matched by `requestId`.

**WebSocket Bridge** (`src/websocket-server/index.ts`): Accepts exactly two client roles — MCP client (identified by `?role=mcp-client` query param) and Figma plugin (identified by sending REGISTER as first message). Routes COMMANDs from MCP→plugin and RESPONSEs from plugin→MCP. One connection per role; new connections replace old ones.

**Figma Plugin** (`src/figma-plugin/`): Runs in Figma Desktop. `code.ts` is the sandbox with `figma.*` API access. `ui.html` is a hidden iframe that holds the WebSocket connection. They communicate via `figma.ui.postMessage`/`figma.ui.onmessage`. The plugin is bundled with esbuild (not tsc) because Figma requires a single IIFE file.

## Wire Protocol

All messages are JSON with a `requestId` matching pattern `/^req_\d+_[a-z0-9]+$/`.

Three message types: `REGISTER` (plugin→bridge on connect), `COMMAND` (MCP→bridge→plugin), `RESPONSE` (plugin→bridge→MCP). Error codes: `NODE_NOT_FOUND`, `INVALID_ARGS`, `COMMAND_NOT_FOUND`, `PLUGIN_DISCONNECTED`, `TIMEOUT`, `EXECUTION_ERROR`, `FONT_UNAVAILABLE`, `INTERNAL_ERROR`.

## Key Design Decisions

- Tool schemas are defined once in `src/mcp-server/tools.ts` using Zod with `.strict()`. The `TOOL_REGISTRY` maps tool names to `{description, inputSchema}`.
- The plugin has a hardcoded command allowlist in both `code.ts` and `ui.html` (defense-in-depth). When adding a new tool, update all three: `tools.ts`, `code.ts` allowlist + handler, `ui.html` allowlist.
- `schema-converter.ts` exists but is no longer imported by `index.ts` — `McpServer.registerTool()` handles schema conversion. It's kept for its test coverage.
- Bridge binds to `127.0.0.1` only (no network exposure). Max message size: 64KB.
- Plugin auto-reconnects with exponential backoff (1s base, 2x multiplier, 30s max, random jitter).

## Two Separate TypeScript Configs

- `tsconfig.json`: Compiles `src/mcp-server/` and `src/websocket-server/` to `dist/` (ES2022, Node16 modules)
- `tsconfig.plugin.json`: For the Figma plugin (ES6 target, bundler resolution) — but actual bundling is done by `esbuild.plugin.mjs`, not tsc

## Test Structure

Tests use vitest. Coverage includes `src/mcp-server/**` and `src/websocket-server/**` (plugin excluded — it requires Figma runtime).

- `tests/mcp-server/tools.test.ts` — Zod schema validation for all 15 tools (valid/invalid inputs)
- `tests/mcp-server/request-tracker.test.ts` — Timeout, resolve, reject, rejectAll
- `tests/mcp-server/schema-converter.test.ts` — Zod→JSON Schema conversion
- `tests/websocket-server/bridge.test.ts` — Bridge routing, client management, disconnect handling
- `tests/integration/roundtrip.test.ts` — Full MCP→bridge→mock-plugin→bridge→MCP round-trips
