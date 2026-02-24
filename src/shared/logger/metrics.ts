export interface MetricEntry {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
}

export interface MetricsSnapshot {
  commands: Record<string, MetricEntry>;
  connections: {
    mcpConnects: number;
    mcpDisconnects: number;
    pluginRegistrations: number;
    pluginDisconnects: number;
  };
  errors: Record<string, number>;
  timeouts: number;
  messagesIn: number;
  messagesOut: number;
  startedAt: string;
}

type ConnectionEvent =
  | "mcpConnects"
  | "mcpDisconnects"
  | "pluginRegistrations"
  | "pluginDisconnects";

export class MetricsCollector {
  private commands = new Map<string, MetricEntry>();
  private errors = new Map<string, number>();
  private connectionCounters = {
    mcpConnects: 0,
    mcpDisconnects: 0,
    pluginRegistrations: 0,
    pluginDisconnects: 0,
  };
  private timeouts = 0;
  private messagesIn = 0;
  private messagesOut = 0;
  private startedAt = new Date().toISOString();

  recordCommand(command: string, durationMs: number): void {
    const existing = this.commands.get(command);
    if (existing) {
      existing.count += 1;
      existing.totalMs += durationMs;
      existing.minMs = Math.min(existing.minMs, durationMs);
      existing.maxMs = Math.max(existing.maxMs, durationMs);
      existing.lastMs = durationMs;
    } else {
      this.commands.set(command, {
        count: 1,
        totalMs: durationMs,
        minMs: durationMs,
        maxMs: durationMs,
        lastMs: durationMs,
      });
    }
  }

  recordError(code: string): void {
    this.errors.set(code, (this.errors.get(code) ?? 0) + 1);
  }

  recordTimeout(): void {
    this.timeouts += 1;
  }

  recordConnection(event: ConnectionEvent): void {
    this.connectionCounters[event] += 1;
  }

  recordMessageIn(): void {
    this.messagesIn += 1;
  }

  recordMessageOut(): void {
    this.messagesOut += 1;
  }

  snapshot(): MetricsSnapshot {
    const commands: Record<string, MetricEntry> = {};
    for (const [k, v] of this.commands) {
      commands[k] = { ...v };
    }
    return {
      commands,
      connections: { ...this.connectionCounters },
      errors: Object.fromEntries(this.errors),
      timeouts: this.timeouts,
      messagesIn: this.messagesIn,
      messagesOut: this.messagesOut,
      startedAt: this.startedAt,
    };
  }

  reset(): void {
    this.commands.clear();
    this.errors.clear();
    this.connectionCounters = {
      mcpConnects: 0,
      mcpDisconnects: 0,
      pluginRegistrations: 0,
      pluginDisconnects: 0,
    };
    this.timeouts = 0;
    this.messagesIn = 0;
    this.messagesOut = 0;
    this.startedAt = new Date().toISOString();
  }
}
