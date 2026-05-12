type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

function formatEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };
  const formatted = formatEntry(entry);
  if (level === "error") {
    process.stderr.write(formatted + "\n");
  } else {
    process.stdout.write(formatted + "\n");
  }
}

export const logger = {
  debug: (message: string, ctx?: Record<string, unknown>) => log("debug", message, ctx),
  info: (message: string, ctx?: Record<string, unknown>) => log("info", message, ctx),
  warn: (message: string, ctx?: Record<string, unknown>) => log("warn", message, ctx),
  error: (message: string, ctx?: Record<string, unknown>) => log("error", message, ctx),
};

export function requestDuration(startMs: number): Record<string, unknown> {
  return { durationMs: Date.now() - startMs };
}
