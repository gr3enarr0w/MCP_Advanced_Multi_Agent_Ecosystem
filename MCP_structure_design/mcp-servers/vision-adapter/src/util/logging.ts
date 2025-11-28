import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  [key: string]: unknown;
}

class Logger {
  private stream: ReturnType<typeof createWriteStream> | null = null;
  private levelOrder: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };
  private minLevel: LogLevel;

  constructor(component: string) {
    const mcpHome = join(homedir(), '.mcp');
    const logDir = join(mcpHome, 'logs');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const logPath = join(logDir, 'vision-adapter-mcp.log');
    this.stream = createWriteStream(logPath, { flags: 'a' });

    const envLevel = (process.env.VISION_ADAPTER_LOG_LEVEL || 'info').toLowerCase();
    this.minLevel =
      (['debug', 'info', 'warn', 'error'] as LogLevel[]).includes(envLevel as LogLevel)
        ? (envLevel as LogLevel)
        : 'info';

    this.debug('logger_init', { component });
  }

  debug(message: string, fields?: LogFields) {
    this.log('debug', message, fields);
  }

  info(message: string, fields?: LogFields) {
    this.log('info', message, fields);
  }

  warn(message: string, fields?: LogFields) {
    this.log('warn', message, fields);
  }

  error(message: string, fields?: LogFields) {
    this.log('error', message, fields);
  }

  private log(level: LogLevel, message: string, fields?: LogFields) {
    if (this.levelOrder[level] < this.levelOrder[this.minLevel]) {
      return;
    }

    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...((fields || {}) as object),
    };

    const line = JSON.stringify(entry);

    // Write to stderr for MCP host visibility
    // Avoid throwing from logger; swallow errors.
    try {
      // eslint-disable-next-line no-console
      console.error(line);
    } catch {
      // ignore
    }

    if (this.stream) {
      try {
        this.stream.write(line + '\n');
      } catch {
        // ignore stream errors to avoid breaking tools
      }
    }
  }
}

let defaultLogger: Logger | null = null;

export function getLogger(component = 'vision-adapter-mcp'): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger(component);
  }
  return defaultLogger;
}