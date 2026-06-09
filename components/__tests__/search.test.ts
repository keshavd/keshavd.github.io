import { describe, it, expect } from "vitest";

/**
 * Test suite for search functionality
 * Validates that specific investor questions return relevant documents
 */

type MemoryGraph = {
  person: { id: string; name: string; headline: string; current_focus: string[] };
  entities: Array<{ id: string; type: string; name: string; summary: string; description?: string }>;
  relationships: Array<{ source: string; target: string; type: string; summary: string }>;
  memories: Array<{ id: string; title: string; text: string; entities: string[]; tags: string[] }>;
};

const stopWords = new Set([
  "a", "about", "am", "an", "and", "are", "as", "at", "be", "did", "do", "does",
  "for", "from", "has", "have", "he", "his", "how", "i", "in", "is", "it",
  "me", "my", "of", "on", "or", "the", "to", "was", "what", "when", "where",
  "who", "why", "with"
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function findDocumentMatches(
  question: string,
  kb: MemoryGraph
): Array<{ label: string; text: string; matches: number }> {
  const terms = tokenize(question);
  const results: Array<{ label: string; text: string; matches: number }> = [];

  // Search memories (prioritized)
  kb.memories.forEach((memory) => {
    const searchText = `${memory.title} ${memory.text}`.toLowerCase();
    const matches = terms.filter((term) => searchText.includes(term)).length;
    if (matches > 0) {
      results.push({
        label: `Memory: ${memory.title}`,
        text: memory.text.substring(0, 150) + "...",
        matches
      });
    }
  });

  // Search entities
  kb.entities.forEach((entity) => {
    const searchText = `${entity.name} ${entity.description || entity.summary}`.toLowerCase();
    const matches = terms.filter((term) => searchText.includes(term)).length;
    if (matches > 0) {
      results.push({
        label: `Entity: ${entity.name}`,
        text: (entity.description || entity.summary).substring(0, 150) + "...",
        matches
      });
    }
  });

  // Sort by match count and return top 5
  return results.sort((a, b) => b.matches - a.matches).slice(0, 5);
}

describe("Search Functionality - Investor Questions", () => {
  const kb: MemoryGraph = globalThis.testKB;

  describe("Question: Who are you?", () => {
    it("should find person entity", () => {
      const results = findDocumentMatches("Who are you?", kb);
      expect(results.length).toBeGreaterThan(0);
      const hasPerson = results.some((r) => r.label.includes(kb.person.name));
      expect(hasPerson).toBe(true);
    });
  });

  describe("Question: What is EndoBio?", () => {
    it("should find EndoBio entity", () => {
      const results = findDocumentMatches("What is EndoBio?", kb);
      expect(results.length).toBeGreaterThan(0);
      const hasEndoBio = results.some((r) => r.label.includes("EndoBio"));
      expect(hasEndoBio).toBe(true);
    });
  });

  describe("Question: What is Keshav building?", () => {
    it("should find EndoBio or current focus info", () => {
      const results = findDocumentMatches("What is Keshav building?", kb);
      expect(results.length).toBeGreaterThan(0);
      const relevant = results.some((r) =>
        r.text.toLowerCase().includes("building") ||
        r.text.toLowerCase().includes("endobiο") ||
        r.text.toLowerCase().includes("currently")
      );
      expect(relevant).toBe(true);
    });
  });

  describe("Question: What are the key projects you built at Sanofi?", () => {
    it("should find Sanofi memories or projects", () => {
      const results = findDocumentMatches(
        "What are the key projects you built at Sanofi?",
        kb
      );
      expect(results.length).toBeGreaterThan(0);
      const hasSanofi = results.some((r) => r.text.toLowerCase().includes("sanofi"));
      expect(hasSanofi).toBe(true);
    });
  });

  describe("Question: What makes EndoBio different?", () => {
    it("should find differentiation or advantage info", () => {
      const results = findDocumentMatches("What makes EndoBio different?", kb);
      expect(results.length).toBeGreaterThan(0);
      const hasDiff = results.some((r) =>
        r.text.toLowerCase().includes("advantage") ||
        r.text.toLowerCase().includes("different") ||
        r.text.toLowerCase().includes("unique")
      );
      expect(hasDiff).toBe(true);
    });
  });

  describe("Question: How big is the market?", () => {
    it("should find market opportunity info", () => {
      const results = findDocumentMatches("How big is the market?", kb);
      expect(results.length).toBeGreaterThan(0);
      const hasMarket = results.some((r) =>
        r.text.toLowerCase().includes("market") ||
        r.text.toLowerCase().includes("billion") ||
        r.text.toLowerCase().includes("1.3")
      );
      expect(hasMarket).toBe(true);
    });
  });

  describe("Question: What's your technical background?", () => {
    it("should find expertise information", () => {
      const results = findDocumentMatches("What's your technical background?", kb);
      expect(results.length).toBeGreaterThan(0);
      const hasExpertise = results.some((r) =>
        r.text.toLowerCase().includes("expertise") ||
        r.text.toLowerCase().includes("experience") ||
        r.text.toLowerCase().includes("skill")
      );
      expect(hasExpertise).toBe(true);
    });
  });

  describe("Question: Do you have LLM experience?", () => {
    it("should find Claude integration or LLM info", () => {
      const results = findDocumentMatches("Do you have LLM experience?", kb);
      expect(results.length).toBeGreaterThan(0);
      const hasLLM = results.some((r) =>
        r.text.toLowerCase().includes("claude") ||
        r.text.toLowerCase().includes("llm")
      );
      expect(hasLLM).toBe(true);
    });
  });

  describe("Question: What's your infrastructure approach?", () => {
    it("should find Terraform or infrastructure info", () => {
      const results = findDocumentMatches(
        "What's your infrastructure approach?",
        kb
      );
      expect(results.length).toBeGreaterThan(0);
      const hasInfra = results.some((r) =>
        r.text.toLowerCase().includes("terraform") ||
        r.text.toLowerCase().includes("infrastructure") ||
        r.text.toLowerCase().includes("iac")
      );
      expect(hasInfra).toBe(true);
    });
  });

  describe("Question: What data infrastructure do you use?", () => {
    it("should find Snowflake, Qdrant, Pinecone, Neo4j", () => {
      const results = findDocumentMatches(
        "What data infrastructure do you use?",
        kb
      );
      expect(results.length).toBeGreaterThan(0);
      const tools = ["snowflake", "qdrant", "pinecone", "neo4j"];
      const hasTools = results.some((r) =>
        tools.some((tool) => r.text.toLowerCase().includes(tool))
      );
      expect(hasTools).toBe(true);
    });
  });

  describe("General: All critical topics should be findable", () => {
    it("should find information about EndoBio", () => {
      const results = findDocumentMatches("EndoBio", kb);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find information about Sanofi", () => {
      const results = findDocumentMatches("Sanofi", kb);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find information about experience", () => {
      const results = findDocumentMatches("experience", kb);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find information about agriculture", () => {
      const results = findDocumentMatches("agriculture", kb);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should find information about AI", () => {
      const results = findDocumentMatches("AI", kb);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
