#!/usr/bin/env tsx

import QuickrouteAddressParser from "@globolobo/quickroute-address-parser/standalone";

async function loadEnv(): Promise<void> {
  try {
    const { config } = await import("dotenv");
    const { dirname, join } = await import("path");
    const { fileURLToPath } = await import("url");

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = join(__dirname, ".env");

    config({ path: envPath });
  } catch (error) {
    console.error("not using dotenv, will assume TOMTOM_API_KEY is set");
  }
}

async function basicExample(): Promise<void> {
  const { TOMTOM_API_KEY } = process.env;

  const parser = new QuickrouteAddressParser({
    tomtomApiKey: TOMTOM_API_KEY,
    enableLogging: true,
    timeout: 5000,
  });

  try {
    console.log("🔍 Searching for addresses...");

    const { results, metadata } = await parser.searchAddresses(
      "Collins Street Melbourne",
      3
    );

    console.log(`\n✅ Found ${metadata.resultCount} results:\n`);

    results.forEach((suggestion, index) => {
      const { text, score, address } = suggestion;
      const { suburb, postcode, coordinates } = address;

      console.log(`${index + 1}. ${text}`);
      console.log(`   Score: ${score}`);
      console.log(`   Suburb: ${suburb}`);
      console.log(`   Postcode: ${postcode}`);
      if (coordinates) {
        const { lat, lon } = coordinates;
        console.log(`   📍 ${lat}, ${lon}`);
      }
      console.log("");
    });

    if (metadata.warnings.length > 0) {
      console.log("⚠️  Warnings:");
      metadata.warnings.forEach((warning) => console.log(`   - ${warning}`));
    }
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
  } finally {
    await parser.close();
    console.log("🧹 Cleaned up resources");
  }
}

async function main() {
  // Load environment variables first
  await loadEnv();

  const { TOMTOM_API_KEY } = process.env;

  if (!TOMTOM_API_KEY) {
    console.error("❌ Please set TOMTOM_API_KEY environment variable");
    console.error(
      "   You can set it in a .env file or as an environment variable"
    );
    process.exit(1);
  }

  await basicExample();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
