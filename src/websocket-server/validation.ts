import { REQUEST_ID_PATTERN } from "../shared/constants.js";
import type { RegisterMessage, WireMessage } from "../shared/protocol.js";

// ─── Protocol Error ──────────────────────────────────────────────────────────

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolError";
  }
}

// ─── Message Validation ──────────────────────────────────────────────────────

export function parseAndValidate(raw: string): WireMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ProtocolError("Invalid JSON");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ProtocolError("Message must be a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  if (!["REGISTER", "COMMAND", "RESPONSE"].includes(obj.type as string)) {
    throw new ProtocolError(`Unknown message type: ${String(obj.type)}`);
  }

  if (
    typeof obj.requestId !== "string" ||
    !REQUEST_ID_PATTERN.test(obj.requestId)
  ) {
    throw new ProtocolError(`Invalid requestId: ${String(obj.requestId)}`);
  }

  switch (obj.type) {
    case "REGISTER":
      if (typeof obj.pluginId !== "string" || obj.pluginId.length === 0) {
        throw new ProtocolError("REGISTER requires non-empty pluginId");
      }
      if (
        typeof obj.pluginVersion !== "string" ||
        obj.pluginVersion.length === 0
      ) {
        throw new ProtocolError("REGISTER requires non-empty pluginVersion");
      }
      break;
    case "COMMAND":
      if (typeof obj.command !== "string" || obj.command.length === 0) {
        throw new ProtocolError("COMMAND requires non-empty command string");
      }
      if (
        typeof obj.args !== "object" ||
        obj.args === null ||
        Array.isArray(obj.args)
      ) {
        throw new ProtocolError("COMMAND requires args object");
      }
      break;
    case "RESPONSE":
      if (typeof obj.success !== "boolean") {
        throw new ProtocolError("RESPONSE requires success boolean");
      }
      if (obj.success && (typeof obj.data !== "object" || obj.data === null)) {
        throw new ProtocolError("Success RESPONSE requires data object");
      }
      if (
        !obj.success &&
        (typeof obj.error !== "object" || obj.error === null)
      ) {
        throw new ProtocolError("Error RESPONSE requires error object");
      }
      break;
  }

  return obj as unknown as WireMessage;
}
