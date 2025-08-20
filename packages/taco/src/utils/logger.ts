/**
 * Simple Logging Utility for TACo Web
 * 
 * Provides basic logging functionality with configurable levels.
 * Designed to be lightweight and dependency-free.
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

/**
 * Logging configuration
 */
interface LoggingConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  component?: string;
}

/**
 * Simple logger class for TACo operations
 */
export class Logger {
  private config: LoggingConfig;

  constructor(options: Partial<LoggingConfig> = {}) {
    this.config = {
      level: this.determineLogLevel(options.level),
      enableColors: options.enableColors ?? true,
      enableTimestamps: options.enableTimestamps ?? true,
      component: options.component ?? 'TACo'
    };
  }

  private determineLogLevel(explicitLevel?: LogLevel): LogLevel {
    if (explicitLevel !== undefined) {
      return explicitLevel;
    }

    // Check environment variables in browser-compatible way
    if (typeof process !== 'undefined' && process.env) {
      const envLevel = process.env.TACO_LOG_LEVEL || process.env.LOG_LEVEL;
      if (envLevel) {
        const upperLevel = envLevel.toUpperCase();
        if (upperLevel in LogLevel) {
          return LogLevel[upperLevel as keyof typeof LogLevel];
        }
      }

      const env = process.env.NODE_ENV?.toLowerCase();
      if (env === 'production') return LogLevel.ERROR;
      if (env === 'development') return LogLevel.DEBUG;
      if (env === 'test') return LogLevel.WARN;
    }

    return LogLevel.INFO;
  }

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const levelName = LogLevel[level];
    const timestamp = this.config.enableTimestamps ? new Date().toISOString() : '';
    const component = this.config.component ? `[${this.config.component}]` : '';
    
    let formatted = '';
    if (timestamp) formatted += `${timestamp} `;
    if (component) formatted += `${component} `;
    formatted += `${levelName}: ${message}`;
    
    if (args.length > 0) {
      formatted += ' ' + args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
    }

    return formatted;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (this.shouldLog(level)) {
      console.log(this.formatMessage(level, message, ...args));
    }
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  trace(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.trace(this.formatMessage(LogLevel.TRACE, message, ...args));
    }
  }
}

/**
 * Default logger instance for TACo operations
 */
export const logger = new Logger();
