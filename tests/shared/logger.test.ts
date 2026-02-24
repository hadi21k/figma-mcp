import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createLogger } from "../../src/shared/logger/logger.js";
import { REDACT_PATHS, REDACT_CENSOR } from "../../src/shared/logger/redact.js";

describe("createLogger", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates a logger with the specified component name", () => {
    const log = createLogger({ component: "test", level: "silent" });
    expect(log).toBeDefined();
    expect(typeof log.info).toBe("function");
    expect(typeof log.child).toBe("function");
  });

  it("respects the level option", () => {
    const log = createLogger({ component: "test", level: "error" });
    expect(log.level).toBe("error");
  });

  it("defaults to info level when no level specified", () => {
    delete process.env.LOG_LEVEL;
    const log = createLogger({ component: "test" });
    expect(log.level).toBe("info");
  });

  it("respects LOG_LEVEL environment variable", () => {
    process.env.LOG_LEVEL = "debug";
    const log = createLogger({ component: "test" });
    expect(log.level).toBe("debug");
  });

  it("config level takes precedence over env variable", () => {
    process.env.LOG_LEVEL = "debug";
    const log = createLogger({ component: "test", level: "warn" });
    expect(log.level).toBe("warn");
  });

  it("creates child loggers with inherited context", () => {
    const log = createLogger({ component: "test", level: "silent" });
    const child = log.child({ requestId: "req_1_abc123" });
    expect(child).toBeDefined();
    const bindings = child.bindings();
    expect(bindings.requestId).toBe("req_1_abc123");
  });

  it("child loggers can be further nested", () => {
    const log = createLogger({ component: "test", level: "silent" });
    const child = log.child({ requestId: "req_1_abc123" });
    const grandchild = child.child({ command: "create_frame" });
    const bindings = grandchild.bindings();
    expect(bindings.command).toBe("create_frame");
  });

  it("supports all standard log levels without throwing", () => {
    const log = createLogger({ component: "test", level: "trace" });
    expect(() => {
      log.trace("trace message");
      log.debug("debug message");
      log.info("info message");
      log.warn("warn message");
      log.error("error message");
      log.fatal("fatal message");
    }).not.toThrow();
  });

  it("supports silent level", () => {
    const log = createLogger({ component: "test", level: "silent" });
    expect(log.level).toBe("silent");
    expect(() => log.info("should not output")).not.toThrow();
  });

  it("logs structured objects without throwing", () => {
    const log = createLogger({ component: "test", level: "silent" });
    expect(() => {
      log.info({ host: "127.0.0.1", port: 9001 }, "bridge listening");
      log.error({ err: new Error("test") }, "something failed");
    }).not.toThrow();
  });
});

describe("redact configuration", () => {
  it("REDACT_PATHS contains expected sensitive fields", () => {
    expect(REDACT_PATHS).toContain("password");
    expect(REDACT_PATHS).toContain("token");
    expect(REDACT_PATHS).toContain("imageData");
    expect(REDACT_PATHS).toContain("base64Data");
    expect(REDACT_PATHS).toContain("authorization");
  });

  it("REDACT_CENSOR is a non-empty string", () => {
    expect(typeof REDACT_CENSOR).toBe("string");
    expect(REDACT_CENSOR.length).toBeGreaterThan(0);
  });
});
