type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatContext(context?: Record<string, string | undefined>): string {
  if (!context) return "";
  const parts: string[] = [];
  const { roomId, peerId } = context;
  if (roomId) parts.push(`room=${roomId}`);
  if (peerId) parts.push(`peer=${peerId}`);
  return parts.length > 0 ? ` [${parts.join(" ")}]` : "";
}

export const logger = {
  debug(msg: string, context?: Record<string, string | undefined>): void {
    if (shouldLog("debug")) {
      console.debug(`${formatTimestamp()} DEBUG${formatContext(context)} ${msg}`);
    }
  },
  info(msg: string, context?: Record<string, string | undefined>): void {
    if (shouldLog("info")) {
      console.info(`${formatTimestamp()} INFO${formatContext(context)} ${msg}`);
    }
  },
  warn(msg: string, context?: Record<string, string | undefined>): void {
    if (shouldLog("warn")) {
      console.warn(`${formatTimestamp()} WARN${formatContext(context)} ${msg}`);
    }
  },
  error(msg: string, context?: Record<string, string | undefined>): void {
    if (shouldLog("error")) {
      console.error(`${formatTimestamp()} ERROR${formatContext(context)} ${msg}`);
    }
  },
};
