import { expect } from "vitest";
import { validationPatterns } from "./test-setup";

export const addressAssertions = {
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

  toBeWithinAustralia: (coordinates: { lat: number; lon: number }) => {
    expect(coordinates.lat).toBeGreaterThan(-44);
    expect(coordinates.lat).toBeLessThan(-10);
    expect(coordinates.lon).toBeGreaterThan(113);
    expect(coordinates.lon).toBeLessThan(154);
  },

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

export const errorAssertions = {
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

  toHaveProviderPrefix: (error: Error, provider: string) => {
    expect(error.message).toMatch(new RegExp(`^${provider}\\s`));
  },

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

export const httpAssertions = {
  toHaveBeenCalledWithConfig: (
    mockHttpService: any,
    expectedConfig: Partial<any>
  ) => {
    expect(mockHttpService.request).toHaveBeenCalledWith(
      expect.objectContaining(expectedConfig)
    );
  },

  toHaveBeenCalledTimes: (mockHttpService: any, times: number) => {
    expect(mockHttpService.request).toHaveBeenCalledTimes(times);
  },

  toHaveAuthHeader: (actualConfig: any, expectedToken: string) => {
    expect(actualConfig.headers).toEqual(
      expect.objectContaining({
        Authorization: expect.stringContaining(expectedToken),
      })
    );
  },
};

export const loggingAssertions = {
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

  toHaveMaskedSensitiveData: (logData: any, sensitiveFields: string[]) => {
    sensitiveFields.forEach((field) => {
      if (logData[field] !== undefined) {
        expect(logData[field]).toBe("[REDACTED]");
      }
    });
  },

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

export const mockAssertions = {
  toHaveCalledAllMocks: (mocks: Record<string, any>) => {
    Object.entries(mocks).forEach(([, mock]) => {
      if (mock.mock) {
        expect(mock).toHaveBeenCalled();
      }
    });
  },

  toHaveBeenNthCalledWith: (
    mock: any,
    callIndex: number,
    ...expectedArgs: any[]
  ) => {
    expect(mock).toHaveBeenNthCalledWith(callIndex, ...expectedArgs);
  },

  toHaveBeenCalledWithObjectContaining: (mock: any, expectedProps: any) => {
    expect(mock).toHaveBeenCalledWith(expect.objectContaining(expectedProps));
  },
};

export const asyncAssertions = {
  toResolveWithinTimeout: async (promise: Promise<any>, timeoutMs: number) => {
    const start = Date.now();
    await expect(promise).resolves.toBeDefined();
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(timeoutMs);
  },

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

export const validationAssertions = {
  toMatchZodSchema: (actual: any, expectedFields: string[]) => {
    expectedFields.forEach((field) => {
      expect(actual).toHaveProperty(field);
      expect(actual[field]).toBeDefined();
    });
  },

  toBeValidAustralianAddress: (address: any) => {
    expect(address.country).toBe("Australia");
    expect(address.postcode).toMatch(validationPatterns.australianPostcode);
    expect(address.state).toMatch(/^(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/);
  },

  toBeValidConfidenceScore: (score: number) => {
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(typeof score).toBe("number");
  },
};
