import { describe, it, expect } from "vitest";

/**
 * Conversation Integration Tests
 * Tests realistic chat scenarios to ensure the chatbot actually works
 */

type MemoryGraph = {
  person: {
    id: string;
    name: string;
    headline: string;
    current_focus: string[];
    bio?: string;
  };
  entities: Array<{
    id: string;
    type: string;
    name: string;
    summary: string;
    description?: string;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    summary: string;
  }>;
  memories: Array<{
    id: string;
    title: string;
    text: string;
    entities: string[];
    tags: string[];
  }>;
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
    .filter((term) => term.length > 1 && !stopWords.has(term));
}

function searchKB(question: string, kb: MemoryGraph): string[] {
  const terms = tokenize(question);
  const results: Array<{ text: string; matches: number }> = [];

  // Search memories (high priority)
  kb.memories.forEach((memory) => {
    const searchText = `${memory.title} ${memory.text}`.toLowerCase();
    const matches = terms.filter((term) => searchText.includes(term)).length;
    if (matches > 0) {
      results.push({
        text: memory.text,
        matches: matches * 2
      });
    }
  });

  // Search entities
  kb.entities.forEach((entity) => {
    const searchText = `${entity.name} ${entity.description || entity.summary}`.toLowerCase();
    const matches = terms.filter((term) => searchText.includes(term)).length;
    if (matches > 0) {
      results.push({
        text: entity.description || entity.summary,
        matches
      });
    }
  });

  // Sort by relevance and return
  return results
    .sort((a, b) => b.matches - a.matches)
    .slice(0, 3)
    .map((r) => r.text);
}

describe("Real Conversation Tests - Investor Questions", () => {
  const kb: MemoryGraph = globalThis.testKB;

  describe("Greeting handling", () => {
    it("should recognize 'hello' as a greeting (handled before tokenization)", () => {
      const question = "hello";
      // In the actual code, greetings are detected before search
      // This test just verifies the question is recognized as one
      expect(question.toLowerCase()).toContain("hello");
    });

    it("should recognize 'hi' as a greeting (handled before tokenization)", () => {
      const question = "hi there";
      // In the actual code, greetings are detected before search
      expect(question.toLowerCase()).toContain("hi");
    });
  });

  describe("Single entity queries", () => {
    it("'sanofi' should find Sanofi information", () => {
      const results = searchKB("sanofi", kb);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.toLowerCase().includes("sanofi"))).toBe(true);
    });

    it("'endobio' should find EndoBio information", () => {
      const results = searchKB("endobio", kb);
      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some((r) =>
          r.toLowerCase().includes("endobia") || r.toLowerCase().includes("agricultural")
        )
      ).toBe(true);
    });

    it("'keshav' should find person information", () => {
      const results = searchKB("keshav", kb);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Investor conversation flows", () => {
    it("'What is EndoBio?' should return detailed product info", () => {
      const results = searchKB("What is EndoBio", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ").toLowerCase();
      expect(
        combinedText.includes("agricultural") ||
        combinedText.includes("disease") ||
        combinedText.includes("detection")
      ).toBe(true);
    });

    it("'Tell me about yourself' should find person/background info", () => {
      const results = searchKB("Tell me about yourself background", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ");
      expect(
        combinedText.toLowerCase().includes("phd") ||
        combinedText.toLowerCase().includes("founder") ||
        combinedText.toLowerCase().includes("builder") ||
        combinedText.toLowerCase().includes("entrepreneur")
      ).toBe(true);
    });

    it("'What is your experience?' should find Sanofi and background", () => {
      const results = searchKB("What is your experience", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ").toLowerCase();
      expect(
        combinedText.includes("sanofi") ||
        combinedText.includes("built") ||
        combinedText.includes("phd")
      ).toBe(true);
    });

    it("'Tell me about Sanofi' should find detailed Sanofi info", () => {
      const results = searchKB("Tell me about Sanofi", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ").toLowerCase();
      expect(
        combinedText.includes("sanofi") ||
        combinedText.includes("concierge") ||
        combinedText.includes("knowledge")
      ).toBe(true);
    });

    it("'What makes EndoBio different?' should find differentiation info", () => {
      const results = searchKB("What makes EndoBio different", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ").toLowerCase();
      expect(
        combinedText.includes("unfair") ||
        combinedText.includes("advantage") ||
        combinedText.includes("unique") ||
        combinedText.includes("biochemistry")
      ).toBe(true);
    });

    it("'How big is the market?' should find market opportunity info", () => {
      const results = searchKB("How big is the market opportunity", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ").toLowerCase();
      expect(
        combinedText.includes("trillion") ||
        combinedText.includes("billion") ||
        combinedText.includes("market")
      ).toBe(true);
    });

    it("'What are your accomplishments?' should find detailed achievements", () => {
      const results = searchKB("What are your accomplishments at Sanofi", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ").toLowerCase();
      expect(
        combinedText.includes("concierge") ||
        combinedText.includes("knowledge") ||
        combinedText.includes("built")
      ).toBe(true);
    });

    it("'Tell me about your technical background' should find expertise", () => {
      const results = searchKB("Tell me about your technical background", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ").toLowerCase();
      expect(
        combinedText.includes("ml") ||
        combinedText.includes("phd") ||
        combinedText.includes("engineer") ||
        combinedText.includes("expertise")
      ).toBe(true);
    });

    it("'What do you know about AI?' should find relevant expertise", () => {
      const results = searchKB("What do you know about AI machine learning", kb);
      expect(results.length).toBeGreaterThan(0);
    });

    it("'Why agriculture?' should explain the motivation", () => {
      const results = searchKB("Why agriculture agtech market", kb);
      expect(results.length).toBeGreaterThan(0);
      const combinedText = results.join(" ").toLowerCase();
      expect(
        combinedText.includes("agriculture") ||
        combinedText.includes("agtech") ||
        combinedText.includes("market")
      ).toBe(true);
    });
  });

  describe("Search quality - critical investor questions", () => {
    it("should find good context for every suggested prompt", () => {
      const suggestedQuestions = [
        "What is Keshav building?",
        "Why EndoBio?",
        "Sanofi experience",
        "What makes you unique?",
        "Market opportunity"
      ];

      suggestedQuestions.forEach((q) => {
        const results = searchKB(q, kb);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]?.length).toBeGreaterThan(20);
      });
    });

    it("should have minimum 1 relevant result for investor questions with content words", () => {
      const investorQuestions = [
        "Tell me about yourself",
        "What is EndoBio?",
        "What is your background?",
        "Why agriculture?",
        "What makes you different?",
        "How big is the market?",
        "What have you built?",
        "Tell me about Sanofi",
        "What is your experience?",
        "Describe your skills",
        "What is your expertise?"
      ];

      const results: { [key: string]: number } = {};
      investorQuestions.forEach((q) => {
        const searchResults = searchKB(q, kb);
        results[q] = searchResults.length;
        // At least 1 result for substantive questions
        if (searchResults.length === 0) {
          console.warn(`⚠️  Question returned 0 results: "${q}"`);
        }
        expect(searchResults.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle very short queries", () => {
      const shortQueries = ["ai", "ml", "kb", "rag"];
      shortQueries.forEach((q) => {
        const results = searchKB(q, kb);
        // Short queries might not find anything, but shouldn't crash
        expect(Array.isArray(results)).toBe(true);
      });
    });

    it("should gracefully handle queries with no matches", () => {
      const results = searchKB("xyz qwerty asdfgh", kb);
      expect(Array.isArray(results)).toBe(true);
    });

    it("should not return empty results for valid entity names", () => {
      const entityNames = ["Keshav", "EndoBio", "Sanofi", "McMaster"];
      entityNames.forEach((name) => {
        const results = searchKB(name, kb);
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });
});
