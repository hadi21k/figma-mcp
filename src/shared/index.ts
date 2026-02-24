export {
  COMMAND_NAMES,
  type CommandName,
  REQUEST_ID_PATTERN,
  DEFAULT_WS_HOST,
  DEFAULT_WS_PORT,
  DEFAULT_TIMEOUT_MS,
  MAX_MESSAGE_BYTES,
  LOG_LEVELS,
  type LogLevel,
  DEFAULT_LOG_LEVEL,
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

export {
  createLogger,
  type LogConfig,
  type Logger,
  MetricsCollector,
  type MetricsSnapshot,
  type MetricEntry,
  REDACT_PATHS,
  REDACT_CENSOR,
} from "./logger/index.js";
