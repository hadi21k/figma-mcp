// ─── Command Names (single source of truth) ─────────────────────────────────

export const COMMAND_NAMES = [
  // Read tools
  "get_document_info",
  "get_selection",
  "get_node",
  // Create tools
  "create_frame",
  "create_rectangle",
  "create_ellipse",
  "create_text",
  "create_line",
  "create_polygon",
  // Modify tools
  "set_auto_layout",
  "update_text",
  "update_node",
  "add_shadow",
  // Style tools
  "set_fill",
  "set_stroke",
  "set_corner_radius",
  "set_effects",
  // Layout tools
  "set_node_layout_properties",
  // Organize tools
  "group_nodes",
  "delete_node",
  "create_component",
  "clone_node",
  "reorder_node",
  // Component tools
  "create_component_instance",
  "get_local_components",
  "list_available_fonts",
  // Viewport tools
  "zoom_to_node",
  // Phase 2: Style system tools
  "create_paint_style",
  "create_text_style",
  "get_local_styles",
  "apply_style",
  // Phase 2: Image tools
  "set_image_fill",
  // Phase 2: Export tools
  "export_node",
  // Phase 2: Typography tools
  "set_text_decoration",
  "set_text_case",
  "set_text_list",
  // Phase 2: Constraint & grid tools
  "set_constraints",
  "set_layout_grids",
  // Phase 3: Batch tools
  "batch_create",
  "batch_update",
  // Phase 3: Vector tools
  "create_vector",
  "create_boolean_operation",
  // Phase 3: Page & section tools
  "create_page",
  "create_section",
  // Phase 3: Traversal tools
  "find_nodes",
  // Phase 3: Variable tools
  "create_variable_collection",
  "create_variable",
  "bind_variable",
] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

// ─── Wire Protocol Constants ─────────────────────────────────────────────────

export const REQUEST_ID_PATTERN = /^req_\d+_[a-z0-9]+$/;

// ─── Default Configuration ───────────────────────────────────────────────────

export const DEFAULT_WS_HOST = "127.0.0.1";
export const DEFAULT_WS_PORT = 9001;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_MESSAGE_BYTES = 1_048_576; // 1 MB (increased for image data)
