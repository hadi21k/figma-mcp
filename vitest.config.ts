import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/shared/**", "src/mcp-server/**", "src/websocket-server/**"],
      exclude: [
        "src/figma-plugin/**",
        // Excluded because it requires a live WebSocket bridge and stdio transport to run
        "src/mcp-server/index.ts",
        // Excluded because it manages live WebSocket connections
        "src/mcp-server/ws-client.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
