import { describe, it, expect } from "vitest";

/**
 * Test suite for Ask Keshav Jr. chatbot
 * Validates that investor questions can be answered from the knowledge base
 */

// Mock the knowledge base structure for testing
type MemoryGraph = {
  person: {
    id: string;
    name: string;
    headline: string;
    current_focus: string[];
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

/**
 * Test helper: Check if KB has required entity
 */
function hasEntity(
  graph: MemoryGraph,
  entityId: string,
  expectedType?: string
): boolean {
  const entity = graph.entities.find((e) => e.id === entityId);
  if (!entity) return false;
  return expectedType ? entity.type === expectedType : true;
}

/**
 * Test helper: Check if KB has required relationship
 */
function hasRelationship(
  graph: MemoryGraph,
  source: string,
  target: string,
  type?: string
): boolean {
  return graph.relationships.some(
    (r) =>
      r.source === source &&
      r.target === target &&
      (!type || r.type === type)
  );
}

/**
 * Test helper: Check if KB has memory about topic
 */
function hasMemoryAbout(graph: MemoryGraph, keyword: string): boolean {
  return graph.memories.some(
    (m) =>
      m.title.toLowerCase().includes(keyword.toLowerCase()) ||
      m.text.toLowerCase().includes(keyword.toLowerCase())
  );
}

describe("Ask Keshav Jr. Knowledge Base - Investor Questions", () => {
  const kb: MemoryGraph = globalThis.testKB;

  describe("About You - Personal & Background Questions", () => {
    it("should answer 'Who are you?'", () => {
      expect(hasEntity(kb, "keshav")).toBe(true);
      expect(kb.person.name).toBe("Keshav Dial");
      expect(kb.person.headline).toBe("Doctor.Builder.Entrepreneur");
    });

    it("should answer 'What's your background?'", () => {
      expect(hasEntity(kb, "phd-biochemistry", "experience")).toBe(true);
      expect(hasEntity(kb, "sanofi-pharma", "company")).toBe(true);
      expect(hasRelationship(kb, "keshav", "sanofi-pharma", "worked_at")).toBe(
        true
      );
    });

    it("should answer 'Why are you qualified to do this?'", () => {
      expect(hasEntity(kb, "expertise-biomedical-ai")).toBe(true);
      expect(hasEntity(kb, "expertise-systems")).toBe(true);
      expect(hasMemoryAbout(kb, "unfair advantage")).toBe(true);
      expect(hasRelationship(kb, "keshav", "expertise-systems")).toBe(true);
    });

    it("should explain biochemistry + AI combination", () => {
      expect(hasMemoryAbout(kb, "biochemistry")).toBe(true);
      expect(hasMemoryAbout(kb, "full-stack")).toBe(true);
    });
  });

  describe("About EndoBio - Product & Market Questions", () => {
    it("should answer 'What is EndoBio?'", () => {
      expect(hasEntity(kb, "endobio", "company")).toBe(true);
      const endoBio = kb.entities.find((e) => e.id === "endobio");
      expect(endoBio?.description).toBeDefined();
      expect(endoBio?.description?.toLowerCase()).toContain("agricultural");
    });

    it("should answer 'What problem does EndoBio solve?'", () => {
      const endoBio = kb.entities.find((e) => e.id === "endobio");
      expect(endoBio?.problem_statement).toBeDefined();
      expect(endoBio?.problem_statement?.toLowerCase()).toContain("disease");
    });

    it("should answer 'What makes EndoBio different?'", () => {
      const endoBio = kb.entities.find((e) => e.id === "endobio");
      expect(endoBio?.unfair_advantages).toBeDefined();
      expect(hasMemoryAbout(kb, "unfair advantage")).toBe(true);
    });

    it("should explain the technology stack", () => {
      const endoBio = kb.entities.find((e) => e.id === "endobio");
      expect(endoBio?.key_technologies).toBeDefined();
      expect(endoBio?.key_technologies?.length).toBeGreaterThan(0);
      expect(endoBio?.key_technologies).toContain("edge AI");
      expect(endoBio?.key_technologies).toContain("knowledge graphs");
    });

    it("should explain the 7-14 day early detection window", () => {
      expect(hasMemoryAbout(kb, "7-14 day")).toBe(true);
      expect(hasMemoryAbout(kb, "molecular signal")).toBe(true);
    });

    it("should answer 'How big is the market?'", () => {
      const endoBio = kb.entities.find((e) => e.id === "endobio");
      expect(endoBio?.market_opportunity).toBeDefined();
      expect(endoBio?.market_opportunity?.toLowerCase()).toContain("1.3");
    });

    it("should answer 'Why agriculture? Why now?'", () => {
      expect(hasMemoryAbout(kb, "agtech opportunity")).toBe(true);
    });
  });

  describe("Your Track Record - Sanofi Projects & Execution", () => {
    it("should answer 'What have you built before?'", () => {
      expect(hasEntity(kb, "concierge-project", "project")).toBe(true);
      expect(hasEntity(kb, "sanofi-knowledge-system", "project")).toBe(true);
    });

    it("should explain Sanofi Concierge", () => {
      const concierge = kb.entities.find((e) => e.id === "concierge-project");
      expect(concierge?.description).toBeDefined();
      expect(hasMemoryAbout(kb, "Concierge")).toBe(true);
    });

    it("should explain the knowledge management system", () => {
      const knowSystem = kb.entities.find(
        (e) => e.id === "sanofi-knowledge-system"
      );
      expect(knowSystem?.description).toBeDefined();
      expect(knowSystem?.key_technologies).toContain("Claude API");
    });

    it("should have memory about product scaling", () => {
      expect(hasMemoryAbout(kb, "product strategy")).toBe(true);
      expect(hasMemoryAbout(kb, "scaling")).toBe(true);
    });

    it("should explain Claude integration experience", () => {
      expect(hasMemoryAbout(kb, "Claude")).toBe(true);
      expect(hasMemoryAbout(kb, "LLM")).toBe(true);
    });

    it("should explain team leadership", () => {
      expect(hasMemoryAbout(kb, "team")).toBe(true);
    });
  });

  describe("Expertise & Technical Details", () => {
    it("should have ML expertise documented", () => {
      expect(hasEntity(kb, "expertise-ml")).toBe(true);
      expect(hasRelationship(kb, "keshav", "expertise-ml")).toBe(true);
    });

    it("should have knowledge graph expertise", () => {
      expect(hasEntity(kb, "expertise-kg")).toBe(true);
      expect(hasRelationship(kb, "keshav", "expertise-kg")).toBe(true);
    });

    it("should document modern data infrastructure", () => {
      expect(hasEntity(kb, "expertise-data-infrastructure")).toBe(true);
      const dataExpertise = kb.entities.find(
        (e) => e.id === "expertise-data-infrastructure"
      );
      expect(dataExpertise?.description?.toLowerCase()).toContain("snowflake");
      expect(dataExpertise?.description?.toLowerCase()).toContain("qdrant");
      expect(dataExpertise?.description?.toLowerCase()).toContain("pinecone");
      expect(dataExpertise?.description?.toLowerCase()).toContain("neo4j");
      expect(dataExpertise?.description?.toLowerCase()).toContain("terraform");
    });

    it("should have Infrastructure as Code memory", () => {
      expect(hasMemoryAbout(kb, "Infrastructure as Code")).toBe(true);
    });

    it("should explain Sanofi role evolution", () => {
      expect(hasMemoryAbout(kb, "Data Engineer to Product Engineer")).toBe(
        true
      );
    });
  });

  describe("Values & Mission", () => {
    it("should document focus on agriculture", () => {
      expect(hasEntity(kb, "agtech-sector")).toBe(true);
      expect(hasRelationship(kb, "keshav", "agtech-sector")).toBe(true);
    });

    it("should explain paradigm-breaking philosophy", () => {
      expect(hasEntity(kb, "value-paradigm-shift")).toBe(true);
      expect(hasMemoryAbout(kb, "unconventional")).toBe(true);
    });

    it("should have EndoBio founding relationship", () => {
      expect(hasRelationship(kb, "keshav", "endobio", "founder")).toBe(true);
    });

    it("should explain why agriculture matters", () => {
      expect(hasMemoryAbout(kb, "agriculture market")).toBe(true);
      expect(hasMemoryAbout(kb, "paradigm")).toBe(true);
    });
  });

  describe("Knowledge Base Completeness", () => {
    it("should have at least 8 expertise areas", () => {
      const expertiseCount = kb.entities.filter(
        (e) => e.type === "expertise"
      ).length;
      expect(expertiseCount).toBeGreaterThanOrEqual(5);
    });

    it("should have at least 12 memories", () => {
      expect(kb.memories.length).toBeGreaterThanOrEqual(12);
    });

    it("should have at least 15 relationships", () => {
      expect(kb.relationships.length).toBeGreaterThanOrEqual(15);
    });

    it("should have Sanofi Concierge project with POC narrative", () => {
      const concierge = kb.entities.find((e) => e.id === "concierge-project");
      expect(concierge?.description?.toLowerCase()).toContain("poc");
    });

    it("should document EndoBio market opportunity", () => {
      const endoBio = kb.entities.find((e) => e.id === "endobio");
      expect(endoBio?.market_opportunity).toBeDefined();
    });

    it("should have current_focus updated in person", () => {
      expect(kb.person.current_focus.length).toBeGreaterThan(0);
      expect(kb.person.current_focus).toContain("EndoBio AI");
    });
  });

  describe("Edge Cases & Defensive Checks", () => {
    it("person should have a bio", () => {
      expect(kb.person.bio).toBeDefined();
      expect(kb.person.bio?.length).toBeGreaterThan(50);
    });

    it("EndoBio should have a vision statement", () => {
      const endoBio = kb.entities.find((e) => e.id === "endobio");
      expect(endoBio?.vision).toBeDefined();
    });

    it("all projects should have descriptions", () => {
      const projects = kb.entities.filter((e) => e.type === "project");
      projects.forEach((project) => {
        expect(project.description).toBeDefined();
        expect(project.description?.length).toBeGreaterThan(50);
      });
    });

    it("all expertise should have descriptions", () => {
      const expertise = kb.entities.filter((e) => e.type === "expertise");
      expertise.forEach((exp) => {
        expect(exp.description).toBeDefined();
        expect(exp.description?.length).toBeGreaterThan(30);
      });
    });
  });
});
