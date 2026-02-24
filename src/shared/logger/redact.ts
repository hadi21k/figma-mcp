export const REDACT_PATHS = [
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "imageData",
  "base64Data",
] as const;

export const REDACT_CENSOR = "[REDACTED]";
