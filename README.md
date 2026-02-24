# Figma MCP Server

An MCP (Model Context Protocol) server that gives AI assistants like Claude full control over Figma — create frames, components, variables, export assets, and build complete UI designs through natural language.

## How It Works

```
Claude / Cursor
      ↕ stdio (JSON-RPC)
  MCP Server (Node.js)
      ↕ WebSocket
  WS Bridge (127.0.0.1:9001)
      ↕ Plugin API
  Figma Plugin (Figma Desktop)
```

1. You ask Claude to create or modify a design
2. Claude calls an MCP tool — the MCP server validates the arguments
3. The server sends a command over a local WebSocket to the bridge
4. The bridge forwards it to the Figma plugin running in Figma Desktop
5. The plugin executes `figma.*` API calls and returns the result
6. Claude receives the result and continues building

## Prerequisites

- **Node.js** v18 or later
- **Figma Desktop** — the web version does not support plugins with network access
- **Claude Desktop** or **Cursor** (or any MCP-compatible client)

## Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/your-username/figma-mcp.git
cd figma-mcp
npm install
```

### 2. Build the project

```bash
npm run build
```

This compiles `src/mcp-server/` and `src/websocket-server/` to `dist/`. The Figma plugin (`src/figma-plugin/`) is plain JavaScript and needs no compilation.

### 3. Start the WebSocket bridge

```bash
npm run socket
```

For development with auto-reload:

```bash
npm run dev:socket
```

You should see:
```
{"level":"info","component":"bridge","msg":"Listening on 127.0.0.1:9001"}
```

### 4. Load the plugin in Figma Desktop

1. Open **Figma Desktop**
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select `src/figma-plugin/manifest.json`
4. Run it from **Plugins → Development → Figma MCP Bridge**

The plugin UI shows **"Connected"** when the bridge connection is established.

### 5. Connect your AI client

#### Claude Desktop

Add to `claude_desktop_config.json` (find it at `~/Library/Application Support/Claude/` on macOS or `%APPDATA%\Claude\` on Windows):

```json
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/figma-mcp/dist/mcp-server/index.js"]
    }
  }
}
```

#### Cursor

Add to your MCP config (`.cursor/mcp.json` or via **Cursor Settings → MCP**):

```json
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/figma-mcp/dist/mcp-server/index.js"]
    }
  }
}
```

Replace `/ABSOLUTE/PATH/TO/figma-mcp` with the actual path to this repo.

Restart your AI client after saving the config. The Figma tools will appear automatically.

## Available Tools

67 tools organized into categories:

### Reading & Inspection

| Tool | Description |
|------|-------------|
| `get_document_info` | Get document structure: all pages, top-level frames, and metadata |
| `get_selection` | Get all currently selected nodes with their properties |
| `get_node` | Get detailed properties of a specific node by ID |
| `find_nodes` | Search for nodes by type and/or name pattern across the document |

### Creating Shapes & Elements

| Tool | Description |
|------|-------------|
| `create_frame` | Create a layout frame — the primary container for UI design |
| `create_rectangle` | Create a rectangle (background fills, dividers, placeholder shapes) |
| `create_ellipse` | Create an ellipse or circle (avatars, status dots, decorative circles) |
| `create_text` | Create a text node with typography settings |
| `create_line` | Create a line (dividers, separators, strokes) |
| `create_polygon` | Create a regular polygon (triangle, hexagon, etc.) |
| `create_star` | Create a star shape with configurable point count and inner radius |
| `create_vector` | Create a vector node from SVG path data |
| `create_svg_node` | Create a node from an SVG markup string |

### Modifying Nodes

| Tool | Description |
|------|-------------|
| `update_node` | Update position, size, opacity, visibility, name, or fills of any node |
| `update_text` | Update text content or typography of an existing text node |
| `set_auto_layout` | Apply auto layout to a frame for automatic spacing and alignment |
| `set_node_layout_properties` | Set child-level layout properties inside an auto-layout frame |
| `set_fill` | Set solid or gradient fills on any node |
| `set_stroke` | Set stroke (border/outline) with color, dash patterns, and line caps |
| `set_corner_radius` | Set individual corner radii for asymmetric rounding |
| `set_effects` | Set visual effects: drop shadow, inner shadow, blur, background blur |
| `add_shadow` | Add a drop shadow for depth and elevation |
| `set_rotation` | Set the rotation angle of a node in degrees |
| `set_blend_mode` | Set layer blend mode (multiply, screen, overlay, etc.) |
| `set_constraints` | Set responsive pinning/resize constraints |
| `set_layout_grids` | Add column, row, or pixel grids to a frame |
| `set_text_decoration` | Set underline or strikethrough on a text node |
| `set_text_case` | Set text case transformation (upper, title, small caps, etc.) |
| `set_text_list` | Apply bullet or numbered list formatting to a text node |
| `lock_node` | Lock or unlock a node to protect it from accidental edits |

### Organizing Nodes

| Tool | Description |
|------|-------------|
| `group_nodes` | Group multiple nodes into a visual group |
| `ungroup_nodes` | Ungroup a group and move its children to the parent |
| `delete_node` | Permanently remove a node and its children |
| `clone_node` | Duplicate a node with all its properties and children |
| `reorder_node` | Move a node to a specific z-order index within its parent |
| `flatten_node` | Merge a node and its children into a single vector |
| `create_boolean_operation` | Combine shapes with union, intersect, subtract, or exclude |

### Components & Instances

| Tool | Description |
|------|-------------|
| `create_component` | Convert a node into a reusable Figma component |
| `create_component_instance` | Place an instance of an existing component |
| `get_local_components` | List all components defined in the document |
| `combine_as_variants` | Combine multiple components into a variant set |
| `detach_instance` | Detach an instance from its master component |
| `swap_component` | Swap the component an instance references |
| `import_component_by_key` | Import a component from a shared library by key |

### Style System

| Tool | Description |
|------|-------------|
| `create_paint_style` | Create a reusable color/paint style (design token) |
| `create_text_style` | Create a reusable text style (typography token) |
| `create_effect_style` | Create a reusable effect style (elevation/shadow token) |
| `get_local_styles` | List all paint, text, and effect styles in the document |
| `apply_style` | Apply a style to a node by style ID |

### Variables & Design Tokens

| Tool | Description |
|------|-------------|
| `create_variable_collection` | Create a variable collection with support for multiple modes (e.g. Light/Dark) |
| `create_variable` | Create a design token variable: color, number, string, or boolean |
| `bind_variable` | Bind a variable to a node property for theme-aware designs |
| `get_variables` | List all variable collections and their variables |

### Images

| Tool | Description |
|------|-------------|
| `set_image_from_url` | Fetch an image from a public URL and apply it as a fill |
| `set_image_from_path` | Read a local image file and apply it as a fill |
| `set_image_fill` | Apply an image fill using raw base64 data |

### Export

| Tool | Description |
|------|-------------|
| `export_node` | Export a node as PNG, JPG, SVG, or PDF — auto-saved and returned as an image |

### Pages & Sections

| Tool | Description |
|------|-------------|
| `create_page` | Create a new page in the Figma document |
| `create_section` | Create a section on the canvas to visually organize frames |
| `set_current_page` | Navigate to a specific page by ID |

### Workflow & Utility

| Tool | Description |
|------|-------------|
| `zoom_to_node` | Scroll and zoom the canvas to center on a node |
| `set_selection` | Set the canvas selection to specific nodes |
| `list_available_fonts` | List all fonts available in the Figma environment |
| `batch_create` | Create multiple nodes in a single call |
| `batch_update` | Update properties of multiple nodes in a single call |
| `notify` | Show a toast notification in the Figma UI |

## Example Prompts

### Landing Page Hero Section

> "Create a 1440×900 hero section frame. Add a dark navy background, a large white heading 'Build faster with AI', a subtitle below it in lighter gray, and a blue rounded CTA button. Center everything with auto layout."

### Card Component

> "Create a card component — 320×400 frame, 12px corner radius, subtle drop shadow, 16px padding. Include a gray image placeholder at the top, a bold title, a description, and a 'Learn more' link at the bottom."

### Design System Setup

> "Set up a basic design system in this document. Create color styles for Primary (#4F46E5), Background (#F9FAFB), and Text (#111827). Create text styles for Heading H1 (32px bold Inter), Body (16px regular Inter), and Caption (12px regular Inter)."

### Component with Variants

> "Create a button component with three variants: Primary (blue fill, white text), Secondary (white fill, blue border), and Destructive (red fill, white text). Combine them into a variant set."

### Dark/Light Theme with Variables

> "Create a variable collection called 'Theme' with Light and Dark modes. Add a 'Background' color variable: white (#FFFFFF) in Light, dark gray (#1A1A2E) in Dark. Add a 'Text/Primary' color variable: dark (#111827) in Light, white (#F9FAFB) in Dark."

### Image-Based Layout

> "Create a 1200×600 feature section. Fetch the image from https://images.unsplash.com/photo-example and apply it to the left half. On the right half, add a heading and description with auto layout."

## Configuration

### Environment Variables

Copy `.env.example` to `.env` to customize the defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_HOST` | `127.0.0.1` | Host the bridge binds to — keep loopback-only |
| `WS_PORT` | `9001` | Port the bridge listens on |
| `WS_URL` | `ws://127.0.0.1:9001?role=mcp-client` | WebSocket URL the MCP server connects to |
| `WS_TIMEOUT_MS` | `30000` | How long (ms) the MCP server waits for a plugin response |
| `LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `silent` |
| `LOG_PRETTY` | `false` | Set `true` for human-readable colored log output |
| `LOG_FILE` | _(stderr)_ | Absolute path to write logs to a file instead of stderr |

### Export Directory

Exported nodes are auto-saved to `./exports/` by default. Override with the `FIGMA_EXPORT_DIR` environment variable:

```bash
FIGMA_EXPORT_DIR=/my/designs/exports npm run socket
```

## Development

```bash
# Build TypeScript
npm run build

# Watch mode (auto-reload bridge)
npm run dev:socket

# Run all tests
npm test

# Watch tests
npm run test:watch

# Coverage report (80% threshold)
npm run test:coverage
```

## Project Structure

```
figma-mcp/
├── src/
│   ├── shared/                    # Wire protocol & constants (shared between server and bridge)
│   │   ├── constants.ts           # COMMAND_NAMES (single source of truth), defaults
│   │   ├── protocol.ts            # Message types, error codes
│   │   ├── index.ts               # Barrel re-export
│   │   └── logger/                # Structured logging (pino-based)
│   │       ├── logger.ts          # createLogger() factory
│   │       ├── metrics.ts         # MetricsCollector (counters, histograms)
│   │       └── redact.ts          # Sensitive field redaction
│   │
│   ├── mcp-server/                # MCP server (Claude ↔ bridge)
│   │   ├── index.ts               # Server setup, tool registration, server-side tools
│   │   ├── ws-client.ts           # WebSocket client with reconnect logic
│   │   ├── request-tracker.ts     # Promise-based request/response matching
│   │   └── tools/                 # Tool schemas split by category
│   │       ├── index.ts           # Merges all partial registries → TOOL_REGISTRY
│   │       ├── shared-schemas.ts  # Reusable Zod schemas (RGBAColor, Fill, Typography…)
│   │       ├── read-tools.ts
│   │       ├── create-tools.ts
│   │       ├── modify-tools.ts
│   │       ├── organize-tools.ts
│   │       ├── viewport-tools.ts
│   │       ├── style-tools.ts
│   │       ├── layout-tools.ts
│   │       ├── component-tools.ts
│   │       ├── style-system-tools.ts
│   │       ├── image-tools.ts
│   │       ├── export-tools.ts
│   │       ├── typography-tools.ts
│   │       ├── constraint-tools.ts
│   │       ├── batch-tools.ts
│   │       ├── vector-tools.ts
│   │       ├── page-tools.ts
│   │       ├── traversal-tools.ts
│   │       ├── variable-tools.ts
│   │       ├── workflow-tools.ts
│   │       ├── design-system-tools.ts
│   │       ├── manipulation-tools.ts
│   │       └── extra-shape-tools.ts
│   │
│   ├── websocket-server/          # WebSocket bridge (routes commands between MCP and plugin)
│   │   ├── index.ts               # FigmaBridge class and entry point
│   │   ├── config.ts              # BridgeConfig + loadConfig()
│   │   └── validation.ts          # Message validation, ProtocolError
│   │
│   └── figma-plugin/              # Figma plugin (plain JS, no build step)
│       ├── manifest.json          # Plugin manifest
│       ├── code.js                # Plugin sandbox — handles all figma.* API calls
│       └── ui.html                # Hidden iframe — holds the WebSocket connection
│
├── tests/
│   ├── mcp-server/
│   │   ├── tools.test.ts          # Zod schema validation for all tools
│   │   └── request-tracker.test.ts
│   ├── websocket-server/
│   │   └── bridge.test.ts         # Bridge routing and client management
│   ├── integration/
│   │   └── roundtrip.test.ts      # Full MCP → bridge → mock plugin round-trips
│   └── shared/
│       ├── logger.test.ts
│       └── metrics.test.ts
│
├── exports/                       # Auto-created when export_node is used
├── logs/                          # Optional log output directory
├── .env.example                   # Environment variable reference
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Troubleshooting

### Plugin shows "Disconnected" or never connects

1. Make sure `npm run socket` is running and shows "Listening on 127.0.0.1:9001"
2. Confirm the plugin is active in **Plugins → Development → Figma MCP Bridge**
3. If port 9001 is in use by another process, change the port:
   ```bash
   WS_PORT=9002 npm run socket
   ```
   Then update `WS_URL` in `.env` to match.

### Commands time out

1. Confirm the plugin shows "Connected" — commands cannot reach Figma without an active connection
2. Font operations (text nodes) load fonts asynchronously — the default 30s timeout handles most cases
3. For slow operations, increase the timeout: `WS_TIMEOUT_MS=60000`
4. Check that Figma Desktop is responsive and not showing any error dialogs

### Bridge port already in use (EADDRINUSE)

A previous bridge process is still running. On macOS/Linux:

```bash
lsof -i :9001
kill <PID>
```

On Windows (PowerShell):

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 9001).OwningProcess | Stop-Process
```

### MCP tools do not appear in Claude / Cursor

1. Make sure `npm run build` completed without TypeScript errors
2. Verify the absolute path in your MCP config points to `dist/mcp-server/index.js`
3. Restart your AI client after every config change
4. Check your client's MCP logs for connection errors

### Images not loading (`set_image_from_url`)

- The URL must be publicly accessible (no auth, no paywalls)
- Supported formats: PNG, JPEG, GIF, WebP, SVG
- Maximum file size: 5 MB (oversized images are auto-optimized before being sent)

## Architecture Notes

- **Security:** The bridge binds to `127.0.0.1` only — it is never exposed to the network. The plugin's `networkAccess.allowedDomains` is set to `none` in production.
- **Message size:** Maximum WebSocket message is 8 MB to support high-resolution image fills.
- **Reconnection:** The plugin auto-reconnects with exponential backoff (1s base, 2× multiplier, 30s max) if the bridge restarts.
- **Server-side tools:** `set_image_from_url` and `set_image_from_path` run entirely in Node.js (fetch + encode) and forward to `set_image_fill` — they never require extra plugin code.
- **Logging:** All Node.js logs go to stderr to avoid corrupting MCP's JSON-RPC on stdout. Set `LOG_PRETTY=true` for readable development output.

## Contributing

1. Add the command name to `COMMAND_NAMES` in `src/shared/constants.ts`
2. Create the tool schema in the appropriate file under `src/mcp-server/tools/`
3. Add the handler in `src/figma-plugin/code.js`
4. Add the command to `ALLOWED_COMMANDS` in both `code.js` and `ui.html`
5. Add tests in `tests/mcp-server/tools.test.ts`

See `CLAUDE.md` for the full contributor guide.
