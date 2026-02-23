# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build              # TypeScript compile (src/shared + src/mcp-server + src/websocket-server → dist/)
npm run build:all          # Same as build (alias)
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

**MCP Server** (`src/mcp-server/index.ts`): Uses `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`. Tool registration loops over `TOOL_REGISTRY` from `tools/index.ts`. WebSocket client logic lives in `ws-client.ts`. On tool call, sends a COMMAND over WebSocket and awaits a RESPONSE matched by `requestId`.

**WebSocket Bridge** (`src/websocket-server/index.ts`): Accepts exactly two client roles — MCP client (identified by `?role=mcp-client` query param) and Figma plugin (identified by sending REGISTER as first message). Config in `config.ts`, validation in `validation.ts`. Routes COMMANDs from MCP→plugin and RESPONSEs from plugin→MCP.

**Figma Plugin** (`src/figma-plugin/`): Runs in Figma Desktop. `code.js` is the sandbox with `figma.*` API access. `ui.html` is a hidden iframe that holds the WebSocket connection. They communicate via `figma.ui.postMessage`/`figma.ui.onmessage`. Plugin is plain JavaScript (no build step needed).

## Directory Structure

```
src/
├── shared/                          Wire protocol & constants (single source of truth)
│   ├── index.ts                     Barrel re-export
│   ├── protocol.ts                  ErrorCode, message types, WireMessage
│   └── constants.ts                 COMMAND_NAMES, REQUEST_ID_PATTERN, defaults
│
├── mcp-server/
│   ├── index.ts                     Server setup + startup
│   ├── ws-client.ts                 WebSocket client (connect, reconnect, sendCommand)
│   ├── request-tracker.ts           Promise-based request/response tracking
│   └── tools/                       Tool schemas split by category
│       ├── index.ts                 Barrel: merges partial registries → TOOL_REGISTRY
│       ├── shared-schemas.ts        NodeId, RGBAColor, Fill, Typography, etc.
│       ├── read-tools.ts            get_document_info, get_selection, get_node
│       ├── create-tools.ts          create_frame, create_rectangle, create_ellipse, create_text
│       ├── modify-tools.ts          set_auto_layout, update_text, update_node, add_shadow
│       ├── organize-tools.ts        group_nodes, delete_node, create_component
│       └── viewport-tools.ts        zoom_to_node
│
├── websocket-server/
│   ├── index.ts                     FigmaBridge class + entry point
│   ├── config.ts                    BridgeConfig interface + loadConfig()
│   └── validation.ts               ProtocolError + parseAndValidate()
│
└── figma-plugin/                    Plain JS, no build step
    ├── code.js                      Plugin sandbox (figma.* API)
    ├── ui.html                      Hidden iframe (WebSocket connection)
    └── manifest.json                Figma plugin manifest
```

## Wire Protocol

All messages are JSON with a `requestId` matching pattern `/^req_\d+_[a-z0-9]+$/`.

Three message types: `REGISTER` (plugin→bridge on connect), `COMMAND` (MCP→bridge→plugin), `RESPONSE` (plugin→bridge→MCP). Error codes: `NODE_NOT_FOUND`, `INVALID_ARGS`, `COMMAND_NOT_FOUND`, `PLUGIN_DISCONNECTED`, `TIMEOUT`, `EXECUTION_ERROR`, `FONT_UNAVAILABLE`, `INTERNAL_ERROR`.

## Key Design Decisions

- **Shared module** (`src/shared/`): Protocol types and constants defined once, imported by both mcp-server and websocket-server.
- **COMMAND_NAMES** in `src/shared/constants.ts` is the single source of truth for all 15 commands. Plugin files (`code.js`, `ui.html`) maintain their own allowlists for defense-in-depth but reference `constants.ts` via comments.
- Tool schemas are defined in `src/mcp-server/tools/` using Zod with `.strict()`. Each category file exports a partial registry, merged in `tools/index.ts`.
- `McpServer.registerTool()` handles Zod→JSON Schema conversion and input validation internally.
- Bridge binds to `127.0.0.1` only (no network exposure). Max message size: 64KB.
- Plugin auto-reconnects with exponential backoff (1s base, 2x multiplier, 30s max, random jitter).

## Adding a New Tool

When adding a new tool, update all three locations:
1. `src/shared/constants.ts` — add to `COMMAND_NAMES` array
2. `src/mcp-server/tools/` — add schema in appropriate category file + add to partial registry
3. `src/figma-plugin/code.js` — add to `ALLOWED_COMMANDS` Set + add handler
4. `src/figma-plugin/ui.html` — add to `ALLOWED_COMMANDS` array

## TypeScript Config

- `tsconfig.json`: Compiles `src/shared/`, `src/mcp-server/`, and `src/websocket-server/` to `dist/` (ES2022, Node16 modules)
- Plugin (`src/figma-plugin/`) is excluded — it's plain JavaScript, no compilation needed

## Test Structure

Tests use vitest. Coverage includes `src/shared/**`, `src/mcp-server/**`, and `src/websocket-server/**` (plugin excluded — it requires Figma runtime). `ws-client.ts` and `index.ts` in mcp-server are excluded from coverage (they require live connections).

- `tests/mcp-server/tools.test.ts` — Zod schema validation for all 15 tools (valid/invalid inputs)
- `tests/mcp-server/request-tracker.test.ts` — Timeout, resolve, reject, rejectAll
- `tests/websocket-server/bridge.test.ts` — Bridge routing, validation, client management, disconnect handling
- `tests/integration/roundtrip.test.ts` — Full MCP→bridge→mock-plugin→bridge→MCP round-trips
