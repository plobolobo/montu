import { QuickrouteAddressParserService } from "../src/services/quickroute-address-parser.service";
import { validateAddressInput } from "../src/utils/validation.utils";

describe("QuickrouteAddressParserService", () => {
  it("should be defined", () => {
    expect(QuickrouteAddressParserService).toBeDefined();
  });
});

describe("validateAddressInput", () => {
  it("should validate input correctly", () => {
    const input = { query: "Sydney NSW", limit: 10 };
    const result = validateAddressInput(input);
    expect(result.isValid).toBe(true);
  });
});
