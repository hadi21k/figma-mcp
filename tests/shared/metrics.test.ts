import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector } from "../../src/shared/logger/metrics.js";

describe("MetricsCollector", () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  it("starts with empty snapshot", () => {
    const snap = metrics.snapshot();
    expect(Object.keys(snap.commands)).toHaveLength(0);
    expect(Object.keys(snap.errors)).toHaveLength(0);
    expect(snap.timeouts).toBe(0);
    expect(snap.messagesIn).toBe(0);
    expect(snap.messagesOut).toBe(0);
    expect(snap.connections.mcpConnects).toBe(0);
    expect(snap.connections.mcpDisconnects).toBe(0);
    expect(snap.connections.pluginRegistrations).toBe(0);
    expect(snap.connections.pluginDisconnects).toBe(0);
  });

  it("has a valid startedAt timestamp", () => {
    const snap = metrics.snapshot();
    expect(new Date(snap.startedAt).getTime()).not.toBeNaN();
  });

  describe("command recording", () => {
    it("records a single command execution", () => {
      metrics.recordCommand("create_frame", 150);
      const snap = metrics.snapshot();
      expect(snap.commands["create_frame"]).toEqual({
        count: 1,
        totalMs: 150,
        minMs: 150,
        maxMs: 150,
        lastMs: 150,
      });
    });

    it("accumulates multiple executions of the same command", () => {
      metrics.recordCommand("create_frame", 150);
      metrics.recordCommand("create_frame", 200);
      metrics.recordCommand("create_frame", 100);
      const snap = metrics.snapshot();
      const cmd = snap.commands["create_frame"];
      expect(cmd.count).toBe(3);
      expect(cmd.totalMs).toBe(450);
      expect(cmd.minMs).toBe(100);
      expect(cmd.maxMs).toBe(200);
      expect(cmd.lastMs).toBe(100);
    });

    it("tracks different commands independently", () => {
      metrics.recordCommand("create_frame", 150);
      metrics.recordCommand("get_selection", 10);
      const snap = metrics.snapshot();
      expect(Object.keys(snap.commands)).toHaveLength(2);
      expect(snap.commands["create_frame"].count).toBe(1);
      expect(snap.commands["get_selection"].count).toBe(1);
    });
  });

  describe("error recording", () => {
    it("records errors by code", () => {
      metrics.recordError("NODE_NOT_FOUND");
      metrics.recordError("NODE_NOT_FOUND");
      metrics.recordError("TIMEOUT");
      const snap = metrics.snapshot();
      expect(snap.errors["NODE_NOT_FOUND"]).toBe(2);
      expect(snap.errors["TIMEOUT"]).toBe(1);
    });
  });

  describe("connection recording", () => {
    it("records mcp connect events", () => {
      metrics.recordConnection("mcpConnects");
      metrics.recordConnection("mcpConnects");
      const snap = metrics.snapshot();
      expect(snap.connections.mcpConnects).toBe(2);
    });

    it("records plugin registration events", () => {
      metrics.recordConnection("pluginRegistrations");
      const snap = metrics.snapshot();
      expect(snap.connections.pluginRegistrations).toBe(1);
    });

    it("records disconnect events", () => {
      metrics.recordConnection("mcpDisconnects");
      metrics.recordConnection("pluginDisconnects");
      const snap = metrics.snapshot();
      expect(snap.connections.mcpDisconnects).toBe(1);
      expect(snap.connections.pluginDisconnects).toBe(1);
    });
  });

  describe("timeout recording", () => {
    it("records timeout counts", () => {
      metrics.recordTimeout();
      metrics.recordTimeout();
      metrics.recordTimeout();
      const snap = metrics.snapshot();
      expect(snap.timeouts).toBe(3);
    });
  });

  describe("message throughput", () => {
    it("tracks incoming messages", () => {
      metrics.recordMessageIn();
      metrics.recordMessageIn();
      const snap = metrics.snapshot();
      expect(snap.messagesIn).toBe(2);
    });

    it("tracks outgoing messages", () => {
      metrics.recordMessageOut();
      const snap = metrics.snapshot();
      expect(snap.messagesOut).toBe(1);
    });
  });

  describe("snapshot isolation", () => {
    it("returns a copy, not a reference", () => {
      metrics.recordCommand("test", 100);
      const snap1 = metrics.snapshot();
      metrics.recordCommand("test", 200);
      const snap2 = metrics.snapshot();
      expect(snap1.commands["test"].count).toBe(1);
      expect(snap2.commands["test"].count).toBe(2);
    });

    it("connections snapshot is independent", () => {
      metrics.recordConnection("mcpConnects");
      const snap1 = metrics.snapshot();
      metrics.recordConnection("mcpConnects");
      const snap2 = metrics.snapshot();
      expect(snap1.connections.mcpConnects).toBe(1);
      expect(snap2.connections.mcpConnects).toBe(2);
    });
  });

  describe("reset", () => {
    it("resets all metrics to initial state", () => {
      metrics.recordCommand("test", 100);
      metrics.recordError("ERR");
      metrics.recordTimeout();
      metrics.recordConnection("mcpConnects");
      metrics.recordMessageIn();
      metrics.recordMessageOut();

      metrics.reset();
      const snap = metrics.snapshot();

      expect(Object.keys(snap.commands)).toHaveLength(0);
      expect(Object.keys(snap.errors)).toHaveLength(0);
      expect(snap.timeouts).toBe(0);
      expect(snap.messagesIn).toBe(0);
      expect(snap.messagesOut).toBe(0);
      expect(snap.connections.mcpConnects).toBe(0);
    });

    it("generates a new startedAt after reset", () => {
      const snap1 = metrics.snapshot();
      metrics.reset();
      const snap2 = metrics.snapshot();
      expect(new Date(snap2.startedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(snap1.startedAt).getTime(),
      );
    });
  });
});
