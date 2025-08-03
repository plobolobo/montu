export interface LoggingConfig {
  level: "error" | "warn" | "info" | "debug" | "verbose";
  format: "json" | "text";
  enableCorrelationId: boolean;
  enableMetrics: boolean;
  sensitiveFields: string[];
  enableStackTrace: boolean;
  maxStackDepth: number;
}

export const DEFAULT_SENSITIVE_FIELDS = [
  "apiKey",
  "authorization",
  "password",
  "token",
  "secret",
  "key",
  "credentials",
] as const;

export const createLoggingConfig = (): LoggingConfig => ({
  level: (process.env.LOG_LEVEL as LoggingConfig["level"]) || "info",
  format: process.env.NODE_ENV === "production" ? "json" : "text",
  enableCorrelationId: process.env.ENABLE_CORRELATION_ID !== "false",
  enableMetrics: process.env.ENABLE_ERROR_METRICS !== "false",
  sensitiveFields: DEFAULT_SENSITIVE_FIELDS.slice(),
  enableStackTrace: process.env.NODE_ENV !== "production",
  maxStackDepth: parseInt(process.env.MAX_STACK_DEPTH || "10", 10),
});

export const LOGGING_CONFIG_TOKEN = "LOGGING_CONFIG";
