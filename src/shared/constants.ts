// ─── Command Names (single source of truth) ─────────────────────────────────

export const COMMAND_NAMES = [
  "get_document_info",
  "get_selection",
  "get_node",
  "create_frame",
  "set_auto_layout",
  "create_rectangle",
  "create_ellipse",
  "create_text",
  "update_text",
  "update_node",
  "add_shadow",
  "group_nodes",
  "delete_node",
  "create_component",
  "zoom_to_node",
] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

// ─── Wire Protocol Constants ─────────────────────────────────────────────────

export const REQUEST_ID_PATTERN = /^req_\d+_[a-z0-9]+$/;

// ─── Default Configuration ───────────────────────────────────────────────────

export const DEFAULT_WS_HOST = "127.0.0.1";
export const DEFAULT_WS_PORT = 9001;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_MESSAGE_BYTES = 65_536;
