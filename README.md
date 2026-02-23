# Figma MCP Server

An MCP (Model Context Protocol) server that allows Claude to generate and manipulate Figma designs in real time.

## Architecture

```
┌──────────┐   stdio    ┌────────────┐  WebSocket   ┌───────────────┐  Plugin API  ┌──────────────┐
│  Claude   │◄─────────►│ MCP Server │◄────────────►│ WS Bridge     │◄────────────►│ Figma Plugin │
│  Desktop  │  JSON-RPC  │ (Node.js)  │  JSON msgs   │ (127.0.0.1:   │  figma.*     │ (Figma       │
│           │            │            │              │  9001)         │              │  Desktop)    │
└──────────┘            └────────────┘              └───────────────┘              └──────────────┘
```

**Flow:** Claude calls an MCP tool → MCP server validates args and sends a COMMAND over WebSocket → Bridge routes it to the Figma plugin → Plugin executes `figma.*` API calls → Plugin sends RESPONSE back through the bridge → MCP server returns the result to Claude.

## Prerequisites

- **Node.js** v18+ (via nvm recommended)
- **Figma Desktop** (not the web version — plugins with network access require the desktop app)
- **Claude Desktop** or **Claude Code** (any client that supports MCP servers)

## Setup

### 1. Install Dependencies

```bash
cd figma-mcp
npm install
```

### 2. Build Everything

```bash
npm run build:all
```

This compiles:
- `src/mcp-server/` and `src/websocket-server/` → `dist/` (TypeScript → JavaScript)
- `src/figma-plugin/code.ts` → `src/figma-plugin/code.js` (esbuild bundle for Figma)

### 3. Start the WebSocket Bridge

In a terminal, run:

```bash
npm run socket
# or for development with auto-reload:
npm run dev:socket
```

You should see:
```
[bridge] Listening on 127.0.0.1:9001
```

### 4. Import the Plugin into Figma Desktop

1. Open Figma Desktop
2. Go to **Plugins** → **Development** → **Import plugin from manifest...**
3. Navigate to `figma-mcp/src/figma-plugin/manifest.json` and select it
4. Run the plugin from **Plugins** → **Development** → **Figma MCP Bridge**

The plugin UI will show "Connected" when it successfully connects to the bridge.

### 5. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

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

Replace `/ABSOLUTE/PATH/TO/` with the actual path to your `figma-mcp` directory.

### 6. Start Using

Open Claude Desktop and ask it to create Figma designs. The Figma MCP tools will be available automatically.

## Available Tools

| Tool | Description |
|------|-------------|
| `get_document_info` | Get document metadata, pages, and top-level frames |
| `get_selection` | Get all currently selected nodes with properties |
| `get_node` | Get detailed properties of a node by ID |
| `create_frame` | Create a new frame container |
| `set_auto_layout` | Apply or update auto layout on a frame |
| `create_rectangle` | Create a rectangle with optional rounded corners, fills, stroke |
| `create_ellipse` | Create an ellipse or circle |
| `create_text` | Create a text node with typography settings |
| `update_text` | Update text content or style of an existing text node |
| `update_node` | Update position, size, opacity, visibility, name, fills of any node |
| `add_shadow` | Add a drop shadow effect to a node |
| `group_nodes` | Group multiple nodes together |
| `delete_node` | Delete a node from the document |
| `create_component` | Convert an existing node into a reusable component |
| `zoom_to_node` | Scroll and zoom canvas to center on a node |

## Example Prompts

### 1. Create a Landing Page Hero

> "Create a hero section for a landing page. Make a 1440x900 white frame, add a large heading 'Welcome to Our Product' centered, a subheading below it, and a blue call-to-action button with rounded corners."

### 2. Design a Card Component

> "Create a card component with a 320x400 frame, 16px corner radius, a subtle drop shadow, and auto layout with 16px padding. Add a placeholder rectangle at the top for an image, a title text below it, and a description paragraph."

### 3. Build a Navigation Bar

> "Create a horizontal navigation bar frame that's 1440px wide and 64px tall. Use auto layout with horizontal direction, space-between alignment, and 24px horizontal padding. Add a logo text on the left and 4 nav link texts on the right."

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_URL` | `ws://127.0.0.1:9001?role=mcp-client` | WebSocket bridge URL for MCP server |
| `WS_PORT` | `9001` | Port for the WebSocket bridge |
| `WS_TIMEOUT_MS` | `30000` | Timeout for pending requests (ms) |

## Development

### Run in Development Mode

```bash
# Terminal 1: Bridge with auto-reload
npm run dev:socket

# Terminal 2: MCP server with auto-reload (for testing outside Claude)
npm run dev:mcp
```

### Run Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Project Structure

```
figma-mcp/
├── src/
│   ├── mcp-server/
│   │   ├── index.ts             # MCP server entry (stdio transport)
│   │   ├── tools.ts             # Zod tool schemas + registry
│   │   ├── request-tracker.ts   # Pending request management
│   │   └── schema-converter.ts  # Zod → JSON Schema converter
│   ├── websocket-server/
│   │   └── index.ts             # WebSocket bridge
│   └── figma-plugin/
│       ├── manifest.json        # Figma plugin manifest
│       ├── code.ts              # Plugin sandbox (command handlers)
│       └── ui.html              # UI with WebSocket client
├── tests/
│   ├── mcp-server/
│   │   ├── tools.test.ts
│   │   ├── request-tracker.test.ts
│   │   └── schema-converter.test.ts
│   ├── websocket-server/
│   │   └── bridge.test.ts
│   └── integration/
│       └── roundtrip.test.ts
├── ARCHITECTURE.md
├── SECURITY.md
├── package.json
├── tsconfig.json
├── tsconfig.plugin.json
└── vitest.config.ts
```

## Troubleshooting

### Plugin Not Connecting

1. **Is the bridge running?** Check that `npm run socket` shows "Listening on 127.0.0.1:9001"
2. **Is the plugin running?** Re-run it from Plugins → Development → Figma MCP Bridge
3. **Check the plugin UI:** If visible, it shows connection status. Look for "Connecting..." or error messages
4. **Port conflict:** If port 9001 is in use, set a different port: `WS_PORT=9002 npm run socket`

### `figma` Global Undefined

This error means code is trying to use the `figma.*` API outside the plugin sandbox. The `code.ts` file runs inside Figma's plugin sandbox where `figma` is a global. If you see this error:
- During tests: This is expected — tests mock the plugin behavior, they don't run inside Figma
- During development: Make sure you're running the plugin through Figma Desktop, not directly with Node.js

### Timeout Errors

If commands are timing out:
1. **Check plugin connection:** The plugin must be connected to the bridge before sending commands
2. **Font loading:** Text commands require font loading which can take time. The default 30s timeout should be sufficient
3. **Increase timeout:** Set `WS_TIMEOUT_MS=60000` for slower operations
4. **Check Figma:** Ensure Figma Desktop is responsive and not frozen

### Bridge Already Running

If you get "EADDRINUSE" when starting the bridge:
```bash
# Find and kill the existing process
lsof -i :9001
kill <PID>
```

### MCP Server Not Showing in Claude

1. Verify the path in `claude_desktop_config.json` is absolute and correct
2. Make sure `npm run build` completed without errors
3. Restart Claude Desktop after config changes
4. Check Claude Desktop logs for MCP connection errors
