#!/usr/bin/env tsx

import QuickrouteAddressParser from "@globolobo/quickroute-address-parser/standalone";

async function basicExample(): Promise<void> {
  const parser = new QuickrouteAddressParser({
    tomtomApiKey: "", // Your API key here!
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
  await basicExample();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
