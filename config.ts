// Configuration for the Cucumber Studio API
import { CucumberStudioConfig } from './types.js';
import * as fs from 'fs';
import * as path from 'path';

// Define log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Extended configuration with logging options
export interface ExtendedConfig extends CucumberStudioConfig {
  // Logging configuration
  logLevel: LogLevel;
  enableRequestLogging: boolean;
  enableResponseLogging: boolean;
  
  // Cache configuration
  enableCache: boolean;
  cacheTTLSeconds: number;
  
  // Security configuration
  sanitizeErrorMessages: boolean;
  requestTimeoutMs: number;
  
  // Access control
  readOnlyMode: boolean;
}

// Set up log file location
const LOG_DIR = process.env.CUCUMBER_STUDIO_LOG_DIR || './logs';
const LOG_FILE = path.join(LOG_DIR, 'cucumber-studio-mcp.log');

// Ensure log directory exists (synchronous setup is okay at startup)
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (error) {
  console.error('Failed to create log directory:', error);
  // Allow the application to continue, but logging to file will fail.
}

// Environment-based configuration
function getConfigForEnvironment(): ExtendedConfig {
  const env = process.env.NODE_ENV || 'development';
  
  // Base configuration
  const baseConfig: ExtendedConfig = {
    accessToken: process.env.CUCUMBER_STUDIO_ACCESS_TOKEN || "",
    clientId: process.env.CUCUMBER_STUDIO_CLIENT_ID || "",
    uid: process.env.CUCUMBER_STUDIO_UID || "",
    baseUrl: process.env.CUCUMBER_STUDIO_BASE_URL || "https://studio.cucumberstudio.com/api",
    logLevel: parseLogLevel(process.env.CUCUMBER_STUDIO_LOG_LEVEL),
    enableRequestLogging: parseBoolean(process.env.CUCUMBER_STUDIO_ENABLE_REQUEST_LOGGING, true),
    enableResponseLogging: parseBoolean(process.env.CUCUMBER_STUDIO_ENABLE_RESPONSE_LOGGING, false),
    enableCache: parseBoolean(process.env.CUCUMBER_STUDIO_ENABLE_CACHE, true),
    cacheTTLSeconds: parseInt(process.env.CUCUMBER_STUDIO_CACHE_TTL_SECONDS || '120', 10),
    sanitizeErrorMessages: parseBoolean(process.env.CUCUMBER_STUDIO_SANITIZE_ERRORS, true),
    requestTimeoutMs: parseInt(process.env.CUCUMBER_STUDIO_REQUEST_TIMEOUT_MS || '30000', 10),
    readOnlyMode: parseBoolean(process.env.CUCUMBER_STUDIO_READ_ONLY_MODE, false)
  };
  
  // Environment-specific overrides (if environment variables are not set)
  if (!process.env.CUCUMBER_STUDIO_LOG_LEVEL) {
    switch (env) {
      case 'production':
        return {
          ...baseConfig,
          logLevel: LogLevel.ERROR,
          enableRequestLogging: false,
          enableResponseLogging: false,
          sanitizeErrorMessages: true
        };
      case 'test':
        return {
          ...baseConfig,
          logLevel: LogLevel.DEBUG,
          enableCache: false,
          enableRequestLogging: true,
          enableResponseLogging: true
        };
      case 'development':
      default:
        return {
          ...baseConfig,
          logLevel: LogLevel.DEBUG,
          enableRequestLogging: true,
          enableResponseLogging: true,
          sanitizeErrorMessages: false
        };
    }
  }
  
  return baseConfig;
}

// Helper to parse log level from string
function parseLogLevel(level: string | undefined): LogLevel {
  if (!level) return LogLevel.INFO;
  
  switch (level.toLowerCase()) {
    case 'error': return LogLevel.ERROR;
    case 'warn': return LogLevel.WARN;
    case 'info': return LogLevel.INFO;
    case 'debug': return LogLevel.DEBUG;
    default: return LogLevel.INFO;
  }
}

// Helper to parse boolean from environment variables
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
}

// Export the environment-specific configuration
export const config: ExtendedConfig = getConfigForEnvironment();

// Asynchronous write message to log file
async function writeToFile(level: string, message: string, args: any[]): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] ${level}: ${message}`;
    
    if (args.length > 0) {
      const argsStr = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            // Basic cycle detection placeholder - replace with a library for robust handling if needed
            return JSON.stringify(arg, (key, value) => {
              if (value instanceof Error) {
                return { message: value.message, name: value.name }; // Serialize basic error info
              }
              return value;
            });
          } catch (e) {
            // Handle potential stringification errors (e.g., circular references)
            if (e instanceof Error && e.message.includes('circular structure')) {
              return '[Circular Structure]';
            }
            return '[Object could not be stringified]';
          }
        }
        return String(arg);
      }).join(' ');
      
      logMessage += ` ${argsStr}`;
    }
    
    logMessage += '\n';
    
    // Append to log file asynchronously
    await fs.promises.appendFile(LOG_FILE, logMessage);

  } catch (error) {
    // Log errors during logging to stderr only if NOT in MCP mode
    if (process.env.MCP_PROTOCOL !== 'true') {
      console.error('Failed to write to log file:', error);
    }
    // Avoid infinite loops if logging itself fails.
  }
}

// Logger function that respects configured log level and writes asynchronously
export function log(level: LogLevel, message: string, ...args: any[]): void {
  if (level <= config.logLevel) {
    const levelName = LogLevel[level];
    
    // Write to file asynchronously, but don't wait for it (fire and forget)
    // This prevents logging from blocking the main execution flow.
    writeToFile(levelName, message, args).catch(err => {
      // Handle potential errors from the async write operation
      if (process.env.MCP_PROTOCOL !== 'true') {
          console.error('Async log write failed:', err);
      }
    });
    
    // Output ERROR to stderr immediately if not in MCP mode
    if (level === LogLevel.ERROR && process.env.MCP_PROTOCOL !== 'true') {
      const timestamp = new Date().toISOString();
      // Use console.error directly for immediate critical feedback
      console.error(`[${timestamp}] ERROR:`, message, ...args);
    }
  }
}

// Validate configuration at startup
export function validateConfig(): void {
  if (!config.accessToken || !config.clientId || !config.uid) {
    throw new Error("Missing required environment variables. Please set CUCUMBER_STUDIO_ACCESS_TOKEN, CUCUMBER_STUDIO_CLIENT_ID, and CUCUMBER_STUDIO_UID.");
  }
  
  // Log to file only
  log(LogLevel.INFO, `Starting with configuration for environment: ${process.env.NODE_ENV || 'development'}`);
  log(LogLevel.INFO, `Read-only mode: ${config.readOnlyMode ? 'enabled' : 'disabled'}`);
  log(LogLevel.DEBUG, 'Configuration:', {
    ...config,
    accessToken: '[REDACTED]',
    clientId: '[REDACTED]',
    uid: '[REDACTED]'
  });
} 