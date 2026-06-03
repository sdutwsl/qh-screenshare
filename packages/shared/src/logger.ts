type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";
let useJsonFormat = false;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function getLogFormat(): boolean {
  return useJsonFormat;
}

export function setLogFormat(format: "text" | "json"): void {
  useJsonFormat = format === "json";
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  roomId?: string;
  peerId?: string;
}

function formatJson(
  level: string,
  message: string,
  context?: Record<string, string | undefined>,
): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
  return JSON.stringify(entry);
}

function formatText(
  level: string,
  message: string,
  context?: Record<string, string | undefined>,
): string {
  const timestamp = new Date().toISOString();
  const ctxStr = formatContext(context);
  return `${timestamp} ${level}${ctxStr} ${message}`;
}

function formatContext(context?: Record<string, string | undefined>): string {
  if (!context) return "";
  const parts: string[] = [];
  const { roomId, peerId } = context;
  if (roomId) parts.push(`room=${roomId}`);
  if (peerId) parts.push(`peer=${peerId}`);
  return parts.length > 0 ? ` [${parts.join(" ")}]` : "";
}

function output(level: string, message: string, context: Record<string, string | undefined> | undefined, consoleFn: (...args: unknown[]) => void): void {
  if (getLogFormat()) {
    // eslint-disable-next-line no-console
    consoleFn(formatJson(level, message, context));
  } else {
    // eslint-disable-next-line no-console
    consoleFn(formatText(level, message, context));
  }
}

export const logger = {
  debug(msg: string, context?: Record<string, string | undefined>): void {
    if (shouldLog("debug")) {
      output("DEBUG", msg, context, console.debug);
    }
  },
  info(msg: string, context?: Record<string, string | undefined>): void {
    if (shouldLog("info")) {
      output("INFO", msg, context, console.info);
    }
  },
  warn(msg: string, context?: Record<string, string | undefined>): void {
    if (shouldLog("warn")) {
      output("WARN", msg, context, console.warn);
    }
  },
  error(msg: string, context?: Record<string, string | undefined>): void {
    if (shouldLog("error")) {
      output("ERROR", msg, context, console.error);
    }
  },
};
