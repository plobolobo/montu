/**
 * Custom assertion utilities for more specific and meaningful test assertions
 */
import { expect } from "vitest";
import { validationPatterns } from "./test-setup";

/**
 * Assertion utilities for address-related data
 */
export const addressAssertions = {
  /**
   * Assert that an object matches the expected address structure
   */
  toMatchAddress: (actual: any, expected: Partial<any>) => {
    expect(actual).toEqual(
      expect.objectContaining({
        fullAddress: expect.any(String),
        streetNumber: expected.streetNumber || expect.any(String),
        streetName: expected.streetName || expect.any(String),
        suburb: expected.suburb || expect.any(String),
        municipality: expected.municipality || expect.any(String),
        state: expected.state || expect.any(String),
        postcode: expect.stringMatching(validationPatterns.australianPostcode),
        country: expected.country || "Australia",
        coordinates: expect.objectContaining({
          lat: expect.any(Number),
          lon: expect.any(Number),
        }),
        ...expected,
      })
    );
  },

  /**
   * Assert that coordinates are within Australia's bounds
   */
  toBeWithinAustralia: (coordinates: { lat: number; lon: number }) => {
    expect(coordinates.lat).toBeGreaterThan(-44);
    expect(coordinates.lat).toBeLessThan(-10);
    expect(coordinates.lon).toBeGreaterThan(113);
    expect(coordinates.lon).toBeLessThan(154);
  },

  /**
   * Assert that a suggestion matches expected structure
   */
  toMatchSuggestion: (actual: any, expected: Partial<any> = {}) => {
    expect(actual).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        address: expect.any(Object),
        score: expect.any(Number),
        ...expected,
      })
    );

    expect(actual.score).toBeGreaterThanOrEqual(0);
    expect(actual.score).toBeLessThanOrEqual(1);
  },
};

/**
 * Assertion utilities for error responses
 */
export const errorAssertions = {
  /**
   * Assert that an error response matches expected structure
   */
  toMatchErrorResponse: (
    actual: any,
    expectedStatus: number,
    expectedMessage?: string
  ) => {
    expect(actual).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          statusCode: expectedStatus,
          message: expectedMessage
            ? expect.stringContaining(expectedMessage)
            : expect.any(String),
          timestamp: expect.stringMatching(validationPatterns.isoDate),
          path: expect.any(String),
        }),
      })
    );
  },

  /**
   * Assert that an exception has the expected provider prefix
   */
  toHaveProviderPrefix: (error: Error, provider: string) => {
    expect(error.message).toMatch(new RegExp(`^${provider}\\s`));
  },

  /**
   * Assert that an error context contains required fields
   */
  toMatchErrorContext: (actual: any, expected: Partial<any> = {}) => {
    expect(actual).toEqual(
      expect.objectContaining({
        timestamp: expect.stringMatching(validationPatterns.isoDate),
        path: expect.any(String),
        method: expect.any(String),
        correlationId: expect.any(String),
        ...expected,
      })
    );
  },
};

/**
 * Assertion utilities for HTTP interactions
 */
export const httpAssertions = {
  /**
   * Assert that HTTP service was called with expected configuration
   */
  toHaveBeenCalledWithConfig: (
    mockHttpService: any,
    expectedConfig: Partial<any>
  ) => {
    expect(mockHttpService.request).toHaveBeenCalledWith(
      expect.objectContaining(expectedConfig)
    );
  },

  /**
   * Assert that HTTP service was called the expected number of times
   */
  toHaveBeenCalledTimes: (mockHttpService: any, times: number) => {
    expect(mockHttpService.request).toHaveBeenCalledTimes(times);
  },

  /**
   * Assert that headers contain expected authentication
   */
  toHaveAuthHeader: (actualConfig: any, expectedToken: string) => {
    expect(actualConfig.headers).toEqual(
      expect.objectContaining({
        Authorization: expect.stringContaining(expectedToken),
      })
    );
  },
};

/**
 * Assertion utilities for logging
 */
export const loggingAssertions = {
  /**
   * Assert that logger was called with expected level and message pattern
   */
  toHaveLoggedMessage: (
    mockLogger: any,
    level: string,
    messagePattern: string | RegExp
  ) => {
    const calls = mockLogger[level]?.mock?.calls || [];
    const found = calls.some((call: any[]) => {
      const message =
        typeof call[0] === "string" ? call[0] : JSON.stringify(call[0]);
      if (typeof messagePattern === "string") {
        return message.includes(messagePattern);
      }
      return messagePattern.test(message);
    });
    expect(found).toBe(true);
  },

  /**
   * Assert that sensitive data has been masked in logs
   */
  toHaveMaskedSensitiveData: (logData: any, sensitiveFields: string[]) => {
    sensitiveFields.forEach((field) => {
      if (logData[field] !== undefined) {
        expect(logData[field]).toBe("[REDACTED]");
      }
    });
  },

  /**
   * Assert that structured log entry contains required fields
   */
  toMatchStructuredLogEntry: (actual: any, expected: Partial<any> = {}) => {
    expect(actual).toEqual(
      expect.objectContaining({
        timestamp: expect.stringMatching(validationPatterns.isoDate),
        level: expect.any(String),
        message: expect.any(String),
        correlationId: expect.any(String),
        ...expected,
      })
    );
  },
};

/**
 * Assertion utilities for mock verification
 */
export const mockAssertions = {
  /**
   * Assert that all expected mocks were called
   */
  toHaveCalledAllMocks: (mocks: Record<string, any>) => {
    Object.entries(mocks).forEach(([name, mock]) => {
      if (mock.mock) {
        expect(mock).toHaveBeenCalled();
      }
    });
  },

  /**
   * Assert that mock was called with specific arguments at specific index
   */
  toHaveBeenNthCalledWith: (
    mock: any,
    callIndex: number,
    ...expectedArgs: any[]
  ) => {
    expect(mock).toHaveBeenNthCalledWith(callIndex, ...expectedArgs);
  },

  /**
   * Assert that mock was called with object containing specific properties
   */
  toHaveBeenCalledWithObjectContaining: (mock: any, expectedProps: any) => {
    expect(mock).toHaveBeenCalledWith(expect.objectContaining(expectedProps));
  },
};

/**
 * Assertion utilities for async operations
 */
export const asyncAssertions = {
  /**
   * Assert that promise resolves within timeout
   */
  toResolveWithinTimeout: async (promise: Promise<any>, timeoutMs: number) => {
    const start = Date.now();
    await expect(promise).resolves.toBeDefined();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(timeoutMs);
  },

  /**
   * Assert that promise rejects with expected error type and message
   */
  toRejectWithError: async (
    promise: Promise<any>,
    errorType: new (...args: any[]) => Error,
    messagePattern?: string | RegExp
  ) => {
    await expect(promise).rejects.toThrow(errorType);
    if (messagePattern) {
      if (typeof messagePattern === "string") {
        await expect(promise).rejects.toThrow(messagePattern);
      } else {
        const error = await promise.catch((e) => e);
        expect(messagePattern.test(error.message)).toBe(true);
      }
    }
  },
};

/**
 * Assertion utilities for data validation
 */
export const validationAssertions = {
  /**
   * Assert that data matches Zod schema expectations
   */
  toMatchZodSchema: (actual: any, expectedFields: string[]) => {
    expectedFields.forEach((field) => {
      expect(actual).toHaveProperty(field);
      expect(actual[field]).toBeDefined();
    });
  },

  /**
   * Assert that Australian address fields are valid
   */
  toBeValidAustralianAddress: (address: any) => {
    expect(address.country).toBe("Australia");
    expect(address.postcode).toMatch(validationPatterns.australianPostcode);
    expect(address.state).toMatch(/^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/);
  },

  /**
   * Assert that confidence score is valid
   */
  toBeValidConfidenceScore: (score: number) => {
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(typeof score).toBe("number");
  },
};
