type SlidingWindowEntry = {
  timestamps: number[];
};

type SlidingWindowOptions = {
  key: string;
  maxRequests: number;
  nowMs?: number;
  windowMs: number;
};

type SlidingWindowResult = {
  allowed: boolean;
  retryAfterMs: number;
};

declare global {
  var __CAREER_OS_RATE_LIMIT_MAP__: Map<string, SlidingWindowEntry> | undefined;
}

const rateLimitMap = globalThis.__CAREER_OS_RATE_LIMIT_MAP__ ?? new Map<string, SlidingWindowEntry>();
if (!globalThis.__CAREER_OS_RATE_LIMIT_MAP__) {
  globalThis.__CAREER_OS_RATE_LIMIT_MAP__ = rateLimitMap;
}

const MAX_KEYS_BEFORE_SWEEP = 5_000;

function sweepExpiredEntries(nowMs: number, maxWindowMs: number): void {
  for (const [key, entry] of rateLimitMap.entries()) {
    const nextTimestamps = entry.timestamps.filter((timestamp) => nowMs - timestamp < maxWindowMs);
    if (nextTimestamps.length === 0) {
      rateLimitMap.delete(key);
      continue;
    }

    if (nextTimestamps.length !== entry.timestamps.length) {
      rateLimitMap.set(key, { timestamps: nextTimestamps });
    }
  }
}

export function checkSlidingWindowRateLimit({
  key,
  maxRequests,
  nowMs = Date.now(),
  windowMs
}: SlidingWindowOptions): SlidingWindowResult {
  if (rateLimitMap.size > MAX_KEYS_BEFORE_SWEEP) {
    sweepExpiredEntries(nowMs, windowMs);
  }

  const entry = rateLimitMap.get(key) ?? { timestamps: [] };
  const freshTimestamps = entry.timestamps.filter((timestamp) => nowMs - timestamp < windowMs);

  if (freshTimestamps.length >= maxRequests) {
    const oldestTimestamp = freshTimestamps[0] ?? nowMs;
    return {
      allowed: false,
      retryAfterMs: Math.max(1, windowMs - (nowMs - oldestTimestamp))
    };
  }

  freshTimestamps.push(nowMs);
  rateLimitMap.set(key, { timestamps: freshTimestamps });
  return {
    allowed: true,
    retryAfterMs: 0
  };
}
