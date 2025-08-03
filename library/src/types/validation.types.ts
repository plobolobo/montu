/**
 * Immutable validation result structures
 */

export interface ValidationResult<T> {
  readonly isValid: true;
  readonly data: T;
  readonly warnings: readonly string[];
}

export interface ValidationError {
  readonly isValid: false;
  readonly errors: readonly ValidationErrorDetail[];
}

export interface ValidationErrorDetail {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly received?: unknown;
}

export type ValidationOutcome<T> = ValidationResult<T> | ValidationError;

/**
 * Immutable validation configuration
 */
export interface ValidationConfig {
  readonly minLength: number;
  readonly maxLength: number;
  readonly optimalMinLength: number;
  readonly optimalMaxLength: number;
  readonly minLimit: number;
  readonly maxLimit: number;
}

/**
 * Builder for validation warnings
 */
export class ValidationWarningsBuilder {
  private warnings: string[] = [];

  addQueryTooShort(length: number, optimal: number): this {
    this.warnings.push(
      `Query is shorter than optimal length (${optimal} characters). Results may be too broad.`
    );
    return this;
  }

  addQueryTooLong(length: number, optimal: number): this {
    this.warnings.push(
      `Query is longer than optimal length (${optimal} characters). Consider using a more specific search.`
    );
    return this;
  }

  build(): readonly string[] {
    return [...this.warnings];
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }
}
