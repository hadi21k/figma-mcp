export const REDACT_PATHS = [
  "password", "*.password", "**.password",
  "secret", "*.secret", "**.secret",
  "token", "*.token", "**.token",
  "authorization", "*.authorization", "**.authorization",
  "cookie", "*.cookie", "**.cookie",
  "imageData", "*.imageData", "**.imageData",
  "base64Data", "*.base64Data", "**.base64Data",
  "apiKey", "*.apiKey", "**.apiKey",
  "access_token", "*.access_token", "**.access_token",
  "refresh_token", "*.refresh_token", "**.refresh_token",
  "headers.authorization",
  "args.imageData",
  "args.base64Data",
] as const;

export const REDACT_CENSOR = "[REDACTED]";
