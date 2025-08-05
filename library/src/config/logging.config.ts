export interface LoggingConfig {
  level: "error" | "warn" | "info" | "debug" | "verbose";
  format: "json" | "text";
  enableCorrelationId: boolean;
  enableStackTrace: boolean;
  maxStackDepth: number;
}

export const createLoggingConfig = (
  overrides: Partial<LoggingConfig> = {}
): LoggingConfig => ({
  level: overrides.level || "error",
  format: overrides.format || "text",
  enableCorrelationId: overrides.enableCorrelationId || false,
  enableStackTrace: overrides.enableStackTrace === false ? false : true,
  maxStackDepth: overrides.maxStackDepth || 10,
  ...overrides,
});

export const LOGGING_CONFIG_TOKEN = "LOGGING_CONFIG";
