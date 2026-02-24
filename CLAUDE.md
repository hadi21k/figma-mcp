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

**MCP Server** (`src/mcp-server/index.ts`): Uses `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`. Tool registration loops over `TOOL_REGISTRY` from `tools/index.ts`. WebSocket client logic lives in `ws-client.ts`. On tool call, sends a COMMAND over WebSocket and awaits a RESPONSE matched by `requestId`. Some tools are **server-side only** (intercepted before `sendCommand`) — see "Server-side Tools" below.

**WebSocket Bridge** (`src/websocket-server/index.ts`): Accepts exactly two client roles — MCP client (identified by `?role=mcp-client` query param) and Figma plugin (identified by sending REGISTER as first message). Config in `config.ts`, validation in `validation.ts`. Routes COMMANDs from MCP→plugin and RESPONSEs from plugin→MCP.

**Figma Plugin** (`src/figma-plugin/`): Runs in Figma Desktop. `code.js` is the sandbox with `figma.*` API access. `ui.html` is a hidden iframe that holds the WebSocket connection. They communicate via `figma.ui.postMessage`/`figma.ui.onmessage`. Plugin is plain JavaScript (no build step needed).

## Directory Structure

```
src/
├── shared/                          Wire protocol & constants (single source of truth)
│   ├── index.ts                     Barrel re-export
│   ├── protocol.ts                  ErrorCode, message types, WireMessage
│   ├── constants.ts                 COMMAND_NAMES, REQUEST_ID_PATTERN, defaults, LOG_LEVELS
│   └── logger/                      Structured logging & metrics module
│       ├── index.ts                 Barrel re-export
│       ├── logger.ts                createLogger() factory (pino-based), LogConfig
│       ├── metrics.ts               MetricsCollector class (counters, histograms)
│       └── redact.ts                Sensitive field redaction paths
│
├── mcp-server/
│   ├── index.ts                     Server setup + startup
│   ├── ws-client.ts                 WebSocket client (connect, reconnect, sendCommand)
│   ├── request-tracker.ts           Promise-based request/response tracking
│   └── tools/                       Tool schemas split by category
│       ├── index.ts                 Barrel: merges partial registries → TOOL_REGISTRY
│       ├── shared-schemas.ts        NodeId, RGBAColor, Fill, Typography, etc.
│       ├── read-tools.ts            get_document_info, get_selection, get_node
│       ├── create-tools.ts          create_frame, create_rectangle, create_ellipse, create_text, create_line, create_polygon
│       ├── modify-tools.ts          set_auto_layout, update_text, update_node, add_shadow
│       ├── organize-tools.ts        group_nodes, delete_node, create_component, clone_node, reorder_node
│       ├── viewport-tools.ts        zoom_to_node
│       ├── style-tools.ts           set_fill, set_stroke, set_corner_radius, set_effects
│       ├── layout-tools.ts          set_node_layout_properties
│       ├── component-tools.ts       create_component_instance, get_local_components, list_available_fonts
│       ├── style-system-tools.ts    create_paint_style, create_text_style, get_local_styles, apply_style
│       ├── image-tools.ts           set_image_fill, set_image_from_url, set_image_from_path
│       ├── export-tools.ts          export_node
│       ├── typography-tools.ts      set_text_decoration, set_text_case, set_text_list
│       ├── constraint-tools.ts      set_constraints, set_layout_grids
│       ├── batch-tools.ts           batch_create, batch_update
│       ├── vector-tools.ts          create_vector, create_boolean_operation
│       ├── page-tools.ts            create_page, create_section
│       ├── traversal-tools.ts       find_nodes
│       ├── variable-tools.ts        create_variable_collection, create_variable, bind_variable
│       ├── workflow-tools.ts        flatten_node, ungroup_nodes, set_selection, set_current_page, create_effect_style, get_variables
│       ├── design-system-tools.ts   combine_as_variants, detach_instance, swap_component, import_component_by_key
│       ├── manipulation-tools.ts    set_rotation, set_blend_mode, lock_node
│       └── extra-shape-tools.ts     create_star, create_svg_node, notify
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
- **COMMAND_NAMES** in `src/shared/constants.ts` is the single source of truth for all 64 commands. Plugin files (`code.js`, `ui.html`) maintain their own allowlists for defense-in-depth but reference `constants.ts` via comments.
- Tool schemas are defined in `src/mcp-server/tools/` using Zod with `.strict()`. Each category file exports a partial registry, merged in `tools/index.ts`.
- `McpServer.registerTool()` handles Zod→JSON Schema conversion and input validation internally.
- Bridge binds to `127.0.0.1` only (no network exposure). Max message size: 1MB.
- Plugin auto-reconnects with exponential backoff (1s base, 2x multiplier, 30s max, random jitter).
- **Structured logging** via [pino](https://github.com/pinojs/pino). All Node.js logs go to stderr (fd=2) to avoid corrupting MCP's JSON-RPC on stdout. Plugin uses a lightweight `pluginLog()` helper (no pino — Figma sandbox has no Node.js).

## Server-side Tools

Some tools are intercepted in `src/mcp-server/index.ts` **before** `sendCommand` and never reach the plugin. They preprocess inputs and forward to an existing plugin command internally.

| Tool | What it does | Forwards to |
|---|---|---|
| `set_image_from_url` | Fetches an image from a public URL (Node.js `fetch`), encodes to base64 | `set_image_fill` |
| `set_image_from_path` | Reads a local file by absolute path (`readFileSync`), encodes to base64 | `set_image_fill` |

These tools do **not** need entries in `COMMAND_NAMES` or plugin allowlists — the plugin only ever sees the forwarded `set_image_fill` command.

`export_node` results are also post-processed in `index.ts`: the base64 image is auto-saved to `./exports/` (or `FIGMA_EXPORT_DIR`) and returned as an MCP `image` content block so Claude can see it directly. The Figma plugin itself base64-encodes exports using a pure-JS fallback encoder (Figma's QuickJS sandbox has no `btoa` or `Buffer`).

## Adding a New Tool

**Plugin-backed tool** (most tools — runs logic in Figma): update all four locations:
1. `src/shared/constants.ts` — add to `COMMAND_NAMES` array
2. `src/mcp-server/tools/` — add schema in appropriate category file + add to partial registry
3. `src/figma-plugin/code.js` — add to `ALLOWED_COMMANDS` Set + add handler
4. `src/figma-plugin/ui.html` — add to `ALLOWED_COMMANDS` array

**Server-side tool** (runs entirely in Node.js, no plugin involvement): update only two locations:
1. `src/mcp-server/tools/` — add schema in appropriate category file + add to partial registry
2. `src/mcp-server/index.ts` — intercept by `name` before `sendCommand`, handle and return result

Do **not** add server-side tools to `COMMAND_NAMES` or the plugin allowlists.

## TypeScript Config

- `tsconfig.json`: Compiles `src/shared/`, `src/mcp-server/`, and `src/websocket-server/` to `dist/` (ES2022, Node16 modules)
- Plugin (`src/figma-plugin/`) is excluded — it's plain JavaScript, no compilation needed

## Logging & Monitoring

The project uses [pino](https://github.com/pinojs/pino) for structured logging across MCP Server and WebSocket Bridge. The Figma plugin uses a lightweight `pluginLog()` since it runs in a browser sandbox.

### Configuration

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal` / `silent` |
| `LOG_PRETTY` | `false` | Human-readable colored output for development |

```bash
# Development (pretty output)
LOG_PRETTY=true npm run dev:socket

# Debug all messages
LOG_LEVEL=debug LOG_PRETTY=true npm run dev:socket

# Silence logs in CI
LOG_LEVEL=silent npm test
```

### Adding Logging to New Code

```typescript
import { createLogger } from "../shared/logger/index.js";

const log = createLogger({ component: "my-module" });
log.info({ key: "value" }, "descriptive message");

// Request-scoped child logger
const reqLog = log.child({ requestId });
reqLog.debug("processing request");
```

### Logging Guidelines for Contributors

- Always use the shared logger, never raw `console.log`/`console.error`
- Include `requestId` in logs when available (use `log.child({ requestId })`)
- Log arg keys, not full args objects (to avoid logging large payloads like images)
- Use appropriate levels: `debug` for flow tracing, `info` for state changes, `warn` for recoverable issues, `error` for failures
- Never log secrets, tokens, or large binary data — the redact config catches common fields but defense-in-depth is better

### Metrics

Access operational metrics programmatically via `MetricsCollector`:

```typescript
import { MetricsCollector } from "../shared/logger/index.js";
const metrics = new MetricsCollector();
metrics.recordCommand("create_frame", 150);
metrics.recordError("NODE_NOT_FOUND");
metrics.recordConnection("mcpConnects");
// Get snapshot for logging or inspection
const snapshot = metrics.snapshot();
```

The bridge logs its full metrics snapshot on shutdown (SIGINT/SIGTERM).

## Test Structure

Tests use vitest. Coverage includes `src/shared/**`, `src/mcp-server/**`, and `src/websocket-server/**` (plugin excluded — it requires Figma runtime). `ws-client.ts` and `index.ts` in mcp-server are excluded from coverage (they require live connections). `LOG_LEVEL=silent` is set in vitest config to suppress log output.

- `tests/mcp-server/tools.test.ts` — Zod schema validation for all tools (valid/invalid inputs); includes `set_image_from_url` and `set_image_from_path`
- `tests/mcp-server/request-tracker.test.ts` — Timeout, resolve, reject, rejectAll
- `tests/websocket-server/bridge.test.ts` — Bridge routing, validation, client management, disconnect handling
- `tests/integration/roundtrip.test.ts` — Full MCP→bridge→mock-plugin→bridge→MCP round-trips
- `tests/shared/logger.test.ts` — Logger factory, child loggers, level config, redaction constants
- `tests/shared/metrics.test.ts` — MetricsCollector: command timing, errors, connections, snapshots, reset
