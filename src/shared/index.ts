export {
  COMMAND_NAMES,
  type CommandName,
  REQUEST_ID_PATTERN,
  DEFAULT_WS_HOST,
  DEFAULT_WS_PORT,
  DEFAULT_TIMEOUT_MS,
  MAX_MESSAGE_BYTES,
} from "./constants.js";

export {
  type ErrorCode,
  type RegisterMessage,
  type CommandMessage,
  type SuccessResponse,
  type ErrorResponseMsg,
  type ResponseMessage,
  type WireMessage,
} from "./protocol.js";
