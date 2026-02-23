// ─── Error Codes ─────────────────────────────────────────────────────────────

export type ErrorCode =
  | "NODE_NOT_FOUND"
  | "INVALID_ARGS"
  | "COMMAND_NOT_FOUND"
  | "PLUGIN_DISCONNECTED"
  | "TIMEOUT"
  | "EXECUTION_ERROR"
  | "FONT_UNAVAILABLE"
  | "INTERNAL_ERROR";

// ─── Wire Message Types ──────────────────────────────────────────────────────

export interface RegisterMessage {
  type: "REGISTER";
  requestId: string;
  pluginId: string;
  pluginVersion: string;
}

export interface CommandMessage {
  type: "COMMAND";
  requestId: string;
  command: string;
  args: Record<string, unknown>;
}

export interface SuccessResponse {
  type: "RESPONSE";
  requestId: string;
  success: true;
  data: Record<string, unknown>;
}

export interface ErrorResponseMsg {
  type: "RESPONSE";
  requestId: string;
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ResponseMessage = SuccessResponse | ErrorResponseMsg;
export type WireMessage = RegisterMessage | CommandMessage | ResponseMessage;
