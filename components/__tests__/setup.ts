import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Test setup: Load knowledge base before tests run
 * This makes the KB available globally for all test files
 */

export function loadKB() {
  const kbPath = resolve(__dirname, "../../public/data/keshav-kb.json");
  const kbContent = readFileSync(kbPath, "utf-8");
  return JSON.parse(kbContent);
}

// Make KB available globally in tests
declare global {
  var testKB: any;
}

globalThis.testKB = loadKB();
