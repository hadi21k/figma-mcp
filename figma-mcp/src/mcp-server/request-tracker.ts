// ─── Request ID Generation ───────────────────────────────────────────────────

let requestCounter = 0;

export function generateRequestId(): string {
  requestCounter += 1;
  const suffix = Math.random().toString(36).substring(2, 8);
  return `req_${requestCounter}_${suffix}`;
}

export function resetCounter(): void {
  requestCounter = 0;
}

// ─── Request Tracker ─────────────────────────────────────────────────────────

interface PendingRequest {
  requestId: string;
  resolve: (data: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class RequestTracker {
  private pending = new Map<string, PendingRequest>();
  private timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  add(requestId: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Timeout: no response for ${requestId} within ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.pending.set(requestId, { requestId, resolve, reject, timer });
    });
  }

  resolve(requestId: string, data: Record<string, unknown>): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(requestId);
    entry.resolve(data);
    return true;
  }

  reject(requestId: string, error: Error): boolean {
    const entry = this.pending.get(requestId);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(requestId);
    entry.reject(error);
    return true;
  }

  rejectAll(error: Error): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }
}
