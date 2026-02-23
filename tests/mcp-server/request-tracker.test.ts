import { describe, it, expect, beforeEach, vi } from "vitest";
import { RequestTracker, generateRequestId, resetCounter } from "../../src/mcp-server/request-tracker.js";

describe("generateRequestId", () => {
  beforeEach(() => {
    resetCounter();
  });

  it("generates IDs matching the pattern", () => {
    const id = generateRequestId();
    expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
  });

  it("generates incrementing counter", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).toMatch(/^req_1_/);
    expect(id2).toMatch(/^req_2_/);
  });

  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateRequestId());
    }
    expect(ids.size).toBe(100);
  });
});

describe("RequestTracker", () => {
  let tracker: RequestTracker;

  beforeEach(() => {
    tracker = new RequestTracker(1000); // 1s timeout for tests
  });

  it("starts with size 0", () => {
    expect(tracker.size).toBe(0);
  });

  it("increases size when adding requests", () => {
    tracker.add("req_1_abc123");
    expect(tracker.size).toBe(1);

    tracker.add("req_2_def456");
    expect(tracker.size).toBe(2);
  });

  it("resolves a pending request", async () => {
    const promise = tracker.add("req_1_abc123");
    const resolved = tracker.resolve("req_1_abc123", { nodeId: "123:456" });

    expect(resolved).toBe(true);
    expect(tracker.size).toBe(0);

    const result = await promise;
    expect(result).toEqual({ nodeId: "123:456" });
  });

  it("returns false when resolving non-existent request", () => {
    const resolved = tracker.resolve("req_999_xxx999", { data: "test" });
    expect(resolved).toBe(false);
  });

  it("rejects a pending request", async () => {
    const promise = tracker.add("req_1_abc123");
    const rejected = tracker.reject("req_1_abc123", new Error("Test error"));

    expect(rejected).toBe(true);
    expect(tracker.size).toBe(0);

    await expect(promise).rejects.toThrow("Test error");
  });

  it("returns false when rejecting non-existent request", () => {
    const rejected = tracker.reject("req_999_xxx999", new Error("Test"));
    expect(rejected).toBe(false);
  });

  it("rejects all pending requests", async () => {
    const promise1 = tracker.add("req_1_abc123");
    const promise2 = tracker.add("req_2_def456");

    expect(tracker.size).toBe(2);

    tracker.rejectAll(new Error("All rejected"));

    expect(tracker.size).toBe(0);

    await expect(promise1).rejects.toThrow("All rejected");
    await expect(promise2).rejects.toThrow("All rejected");
  });

  it("times out after configured duration", async () => {
    vi.useFakeTimers();

    const shortTracker = new RequestTracker(100);
    const promise = shortTracker.add("req_1_abc123");

    vi.advanceTimersByTime(150);

    await expect(promise).rejects.toThrow("Timeout");
    expect(shortTracker.size).toBe(0);

    vi.useRealTimers();
  });

  it("clears timeout when resolved before timeout", async () => {
    vi.useFakeTimers();

    const promise = tracker.add("req_1_abc123");

    // Resolve before timeout
    tracker.resolve("req_1_abc123", { ok: true });
    const result = await promise;
    expect(result).toEqual({ ok: true });

    // Advancing time should not cause issues
    vi.advanceTimersByTime(2000);
    expect(tracker.size).toBe(0);

    vi.useRealTimers();
  });

  it("handles resolve after timeout gracefully", async () => {
    vi.useFakeTimers();

    const shortTracker = new RequestTracker(100);
    const promise = shortTracker.add("req_1_abc123");

    vi.advanceTimersByTime(150);

    await expect(promise).rejects.toThrow("Timeout");

    // Late resolve should return false
    const resolved = shortTracker.resolve("req_1_abc123", { late: true });
    expect(resolved).toBe(false);

    vi.useRealTimers();
  });
});
