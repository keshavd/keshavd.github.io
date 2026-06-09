import { FormEvent, useMemo, useRef, useState } from "react";
import MemoryGraphBrain from "./MemoryGraphBrain";

type MemoryGraph = {
  person: {
    id: string;
    name: string;
    headline: string;
    current_focus: string[];
    bio?: string;
    location?: string;
    contact?: string;
  };
  entities: Array<{
    id: string;
    type: string;
    name: string;
    summary?: string;
    description?: string;
    founder?: string;
    stage?: string;
    problem_statement?: string;
    vision?: string;
    unfair_advantages?: string;
    key_technologies?: string[];
    market_opportunity?: string;
    institution?: string;
    field?: string;
    owner?: string;
    builder?: string;
    scope?: string;
    tags: string[];
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

type SearchDocument = {
  id: string;
  label: string;
  text: string;
  searchableText: string;
};

type GraphQuery = {
  intent:
    | "find_person"
    | "find_project"
    | "find_skill"
    | "find_experience"
    | "find_education"
    | "find_current"
    | "explain_connection"
    | "search_all";
  entities: string[];
  topics: string[];
  nodeTypes: string[];
  relationshipTypes: string[];
  timeRange?: {
    start?: string;
    end?: string;
  };
};

type GraphSearchHit = {
  id: string;
  kind: "person" | "entity" | "relationship" | "memory";
  type: string;
  label: string;
  text: string;
  searchableText: string;
  score: number;
};

type Message = {
  role: "assistant" | "user";
  content: string;
  confidence?: "low" | "medium" | "high";
};

type WebLLMEngine = {
  chat: {
    completions: {
      create: (request: {
        messages: Array<{
          role: "system" | "assistant" | "user";
          content: string;
        }>;
        temperature?: number;
        max_tokens?: number;
      }) => Promise<{ choices: Array<{ message?: { content?: string } }> }>;
    };
  };
};

const MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";
const UNKNOWN_ANSWER = "I don't know that yet.\nYou should ask Keshav Sr.";

const initialMessage: Message = {
  role: "assistant",
  content:
    "Hey, I'm Keshav Jr. Ask me about Keshav's projects, work, or odd little facts."
};

const suggestedPrompts = [
  "What is Keshav building?",
  "Why EndoBio?",
  "Sanofi",
  "Projects"
];

const stopWords = new Set([
  "a",
  "about",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "did",
  "do",
  "does",
  "for",
  "from",
  "has",
  "have",
  "he",
  "his",
  "how",
  "i",
  "in",
  "is",
  "it",
  "keshav",
  "me",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "was",
  "what",
  "when",
  "where",
  "who",
  "why",
  "with"
]);

const synonyms = new Map<string, string[]>([
  ["made", ["made", "founded", "built", "created", "established", "building"]],
  ["building", ["building", "building", "founder", "built", "founded", "created"]],
  ["founder", ["founder", "made", "founded", "built", "created"]],
  ["built", ["built", "made", "founded", "created", "developed"]],
  ["created", ["created", "made", "founded", "built"]],
  ["work", ["work", "worked", "experience", "role", "job"]],
  ["experience", ["experience", "worked", "work", "role", "job"]],
  ["focus", ["focus", "focused", "focus", "working", "building"]],
  ["knowledge", ["knowledge", "know", "knowing", "expertise", "understand"]],
  ["graph", ["graph", "kg", "knowledge", "graphs"]],
  ["current", ["current", "now", "focus", "building", "working"]],
  ["advantage", ["advantage", "advantage", "differentiation", "unfair", "defensibility", "moat"]],
  ["market", ["market", "opportunity", "size", "tam", "addressable"]],
  ["problem", ["problem", "problem", "challenge", "issue", "pain", "gap"]],
  ["qualified", ["qualified", "qualified", "experienced", "skilled", "background", "expertise"]],
  ["investor", ["investor", "investor", "pitch", "funding", "investment", "capital"]],
  ["infrastructure", ["infrastructure", "infrastructure", "terraform", "iac", "scalable", "deployment"]],
  ["data", ["data", "snowflake", "qdrant", "pinecone", "neo4j", "databases", "vector"]],
  ["scale", ["scale", "scalable", "scaling", "infrastructure", "terraform", "production"]],
  ["projects", ["projects", "projects", "products", "built", "created", "products"]],
  ["sanofi", ["sanofi", "sanofi", "pharma", "pharmaceutical", "enterprise"]]
]);

const topicAliases = new Map<string, string[]>([
  ["agriculture", ["agriculture", "agtech", "farm", "farming", "crop", "crops", "plants"]],
  ["AI", ["ai", "ml", "machine learning", "llm", "llms", "agentic", "rag", "models"]],
  ["biochemistry", ["biochemistry", "biotech", "biology", "molecular", "biomedical"]],
  ["knowledge graphs", ["knowledge graph", "knowledge graphs", "graph", "graphs", "neo4j"]],
  ["infrastructure", ["infrastructure", "iac", "terraform", "cloud", "aws", "docker"]],
  ["enterprise", ["enterprise", "sanofi", "workday", "servicenow", "global"]],
  ["education", ["phd", "degree", "school", "university", "education", "mcmaster"]],
  ["current", ["current", "currently", "now", "working on", "building now", "focus"]],
  ["personal", ["personal", "random", "dog", "pet", "food", "breakfast", "fridge", "color", "colour"]]
]);

const relationshipAliases = new Map<string, string[]>([
  ["founded", ["founder", "founded", "started", "created"]],
  ["built", ["built", "build", "made", "created", "shipped", "developed"]],
  ["worked_at", ["worked", "job", "role", "career", "experience"]],
  ["has_expertise_in", ["knows", "skill", "skills", "expertise", "qualified"]],
  ["applies_expertise", ["applies", "uses", "leverages"]],
  ["focused_on", ["focus", "focused", "working", "now"]],
  ["cares_for", ["dog", "pet"]]
]);

function expandSynonyms(term: string): string[] {
  return synonyms.get(term) || [term];
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function editDistance(first: string, second: string) {
  const distances = Array.from({ length: first.length + 1 }, (_, row) =>
    Array.from({ length: second.length + 1 }, (_, column) =>
      row === 0 ? column : column === 0 ? row : 0
    )
  );

  for (let row = 1; row <= first.length; row += 1) {
    for (let column = 1; column <= second.length; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost
      );
    }
  }

  return distances[first.length][second.length];
}

function termMatches(term: string, haystack: string[]) {
  const termSynonyms = expandSynonyms(term);

  return haystack.some((candidate) => {
    if (candidate === term || termSynonyms.includes(candidate)) {
      return true;
    }

    if (term.length < 5 || candidate.length < 5) {
      return false;
    }

    return editDistance(term, candidate) <= 2;
  });
}

function graphToSearchDocuments(memoryGraph: MemoryGraph[]) {
  return memoryGraph.flatMap((graph) => {
    const personDocument: SearchDocument = {
      id: graph.person.id,
      label: `Person: ${graph.person.name}`,
      text: `${graph.person.name} is ${graph.person.headline}. Current focus: ${graph.person.current_focus.join(", ")}.`,
      searchableText: [
        graph.person.id,
        graph.person.name,
        graph.person.headline,
        ...graph.person.current_focus
      ].join(" ")
    };

    const entityDocuments = graph.entities.map((entity) => ({
      id: entity.id,
      label: `Entity: ${entity.name}`,
      text: `${entity.name} (${entity.type}): ${getEntityText(entity)}`,
      searchableText: [
        entity.id,
        entity.type,
        entity.name,
        entity.summary || "",
        entity.description || "",
        entity.founder || "",
        entity.builder || "",
        entity.field || "",
        entity.stage || "",
        entity.vision || "",
        entity.problem_statement || "",
        entity.unfair_advantages || "",
        entity.market_opportunity || "",
        entity.key_technologies?.join(" ") || "",
        ...entity.tags
      ]
        .filter(Boolean)
        .join(" ")
    }));

    const relationshipDocuments = graph.relationships.map((relationship) => {
      const relationshipSynonyms: Record<string, string> = {
        "founder": "founder built created made established",
        "built": "built founder created made developed",
        "founded": "founder built created made established",
        "has_expertise_in": "expertise knows expert skilled proficient",
        "applies_expertise": "applies expertise uses knowledge leverages",
        "worked_at": "worked experience job role employed"
      };

      const synonymsForType = relationshipSynonyms[relationship.type] || relationship.type;

      return {
        id: `${relationship.source}-${relationship.type}-${relationship.target}`,
        label: `Relationship: ${relationship.source} ${relationship.type} ${relationship.target}`,
        text: `${relationship.source} ${relationship.type} ${relationship.target}: ${relationship.summary}`,
        searchableText: [
          relationship.source,
          relationship.target,
          relationship.type,
          synonymsForType,
          relationship.summary
        ].join(" ")
      };
    });

    const memoryDocuments = graph.memories.map((memory) => ({
      id: memory.id,
      label: `Memory: ${memory.title}`,
      text: `${memory.title}: ${memory.text}`,
      searchableText: [
        memory.id,
        memory.title,
        memory.text,
        ...memory.entities,
        ...memory.tags
      ].join(" ")
    }));

    return [
      personDocument,
      ...entityDocuments,
      ...relationshipDocuments,
      ...memoryDocuments
    ];
  });
}

function searchMemoryGraph(question: string, memoryGraph: MemoryGraph[]) {
  const terms = tokenize(question);
  const documents = graphToSearchDocuments(memoryGraph);
  const scored = documents
    .map((document) => {
      const haystack = tokenize(document.searchableText);
      const baseScore = terms.reduce(
        (total, term) => total + (termMatches(term, haystack) ? 1 : 0),
        0
      );

      // Boost memory documents (they have richer narratives)
      const isMemory = document.label.startsWith("Memory:");
      const boost = isMemory ? 1.5 : 1;
      const score = baseScore * boost;

      return { document, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored
    .slice(0, 5)
    .map(({ document }) => `${document.label}: ${document.text}`);
}

function normalizedTokens(value: string) {
  return normalizeQuestion(value).split(" ").filter(Boolean);
}

function textHasAlias(normalizedText: string, alias: string) {
  const normalizedAlias = normalizeQuestion(alias);

  if (!normalizedAlias) {
    return false;
  }

  if (normalizedAlias.length <= 3) {
    return normalizedText.split(" ").includes(normalizedAlias);
  }

  return normalizedText.includes(normalizedAlias);
}

function inferIntent(question: string): GraphQuery["intent"] {
  const normalizedQuestion = normalizeQuestion(question);

  if (/\b(phd|degree|school|university|education|mcmaster)\b/.test(normalizedQuestion)) {
    return "find_education";
  }

  if (/\b(current|currently|now|working on|building now|focus)\b/.test(normalizedQuestion)) {
    return "find_current";
  }

  if (/\b(who|person|bio|background)\b/.test(normalizedQuestion)) {
    return "find_person";
  }

  if (/\b(project|projects|built|build|made|created|shipped)\b/.test(normalizedQuestion)) {
    return "find_project";
  }

  if (/\b(skill|skills|expertise|knows|qualified|good at)\b/.test(normalizedQuestion)) {
    return "find_skill";
  }

  if (/\b(experience|done|worked|work|career|track record)\b/.test(normalizedQuestion)) {
    return "find_experience";
  }

  if (/\b(connect|connected|connection|relate|relationship|why)\b/.test(normalizedQuestion)) {
    return "explain_connection";
  }

  return "search_all";
}

function inferTopics(question: string) {
  const normalizedQuestion = normalizeQuestion(question);
  const topics = [...topicAliases.entries()]
    .filter(([, aliases]) =>
      aliases.some((alias) => textHasAlias(normalizedQuestion, alias))
    )
    .map(([topic]) => topic);

  const keywordTopics = normalizedTokens(question).filter(
    (term) => term.length > 3 && !stopWords.has(term)
  );

  return [...new Set([...topics, ...keywordTopics])];
}

function inferNodeTypes(question: string, intent: GraphQuery["intent"]) {
  const normalizedQuestion = normalizeQuestion(question);
  const nodeTypes = new Set<string>();

  if (intent === "find_person") {
    nodeTypes.add("person");
  }

  if (
    intent === "find_project" ||
    /\b(project|projects|built|build|made|created|shipped|product|products)\b/.test(
      normalizedQuestion
    )
  ) {
    nodeTypes.add("project");
    nodeTypes.add("company");
  }

  if (
    intent === "find_skill" ||
    /\b(skill|skills|expertise|knows|qualified|advantage)\b/.test(
      normalizedQuestion
    )
  ) {
    nodeTypes.add("expertise");
  }

  if (
    intent === "find_experience" ||
    /\b(experience|done|worked|work|career|background)\b/.test(normalizedQuestion)
  ) {
    nodeTypes.add("project");
    nodeTypes.add("company");
    nodeTypes.add("experience");
    nodeTypes.add("expertise");
    nodeTypes.add("interest");
  }

  if (intent === "find_current") {
    nodeTypes.add("memory");
    nodeTypes.add("company");
    nodeTypes.add("project");
    nodeTypes.add("interest");
  }

  if (/\b(dog|pet|puppy)\b/.test(normalizedQuestion)) {
    nodeTypes.add("dog");
  }

  if (
    intent === "find_education" ||
    /\b(phd|degree|school|university|education)\b/.test(normalizedQuestion)
  ) {
    nodeTypes.add("experience");
    nodeTypes.add("institution");
    nodeTypes.add("memory");
  }

  if (/\b(personal|random|food|breakfast|fridge|color|colour|favourite|favorite)\b/.test(normalizedQuestion)) {
    nodeTypes.add("memory");
    nodeTypes.add("dog");
  }

  return [...nodeTypes];
}

function inferRelationshipTypes(question: string) {
  const normalizedQuestion = normalizeQuestion(question);

  return [...relationshipAliases.entries()]
    .filter(([, aliases]) =>
      aliases.some((alias) => textHasAlias(normalizedQuestion, alias))
    )
    .map(([relationshipType]) => relationshipType);
}

function inferEntities(question: string, memoryGraph: MemoryGraph[]) {
  const normalizedQuestion = normalizeQuestion(question);
  const entities = new Set<string>();

  for (const graph of memoryGraph) {
    if (
      textHasAlias(normalizedQuestion, graph.person.id) ||
      textHasAlias(normalizedQuestion, graph.person.name) ||
      /\b(his|him|he)\b/.test(normalizedQuestion)
    ) {
      entities.add(graph.person.id);
    }

    for (const entity of graph.entities) {
      const aliases = [entity.id, entity.name, ...entity.tags];

      if (aliases.some((alias) => textHasAlias(normalizedQuestion, alias))) {
        entities.add(entity.id);
      }
    }
  }

  return [...entities];
}

function extractTimeRange(question: string): GraphQuery["timeRange"] {
  const years = question.match(/\b(20\d{2}|19\d{2})\b/g);

  if (!years?.length) {
    return undefined;
  }

  const [start, end] = years.sort();
  return { start, end };
}

function buildGraphQuery(question: string, memoryGraph: MemoryGraph[]): GraphQuery {
  const intent = inferIntent(question);

  return {
    intent,
    entities: inferEntities(question, memoryGraph),
    topics: inferTopics(question),
    nodeTypes: inferNodeTypes(question, intent),
    relationshipTypes: inferRelationshipTypes(question),
    timeRange: extractTimeRange(question)
  };
}

function graphToSearchHits(memoryGraph: MemoryGraph[]): GraphSearchHit[] {
  return memoryGraph.flatMap((graph) => {
    const entityNameById = new Map(
      graph.entities.map((entity) => [entity.id, entity.name])
    );
    entityNameById.set(graph.person.id, graph.person.name);

    const personHit: GraphSearchHit = {
      id: graph.person.id,
      kind: "person",
      type: "person",
      label: graph.person.name,
      text: `${graph.person.name} is ${graph.person.headline}. ${graph.person.bio || ""} Current focus: ${graph.person.current_focus.join(", ")}.`,
      searchableText: [
        graph.person.id,
        graph.person.name,
        graph.person.headline,
        graph.person.bio || "",
        ...graph.person.current_focus
      ].join(" "),
      score: 0
    };

    const entityHits = graph.entities.map<GraphSearchHit>((entity) => ({
      id: entity.id,
      kind: "entity",
      type: entity.type,
      label: entity.name,
      text: `${entity.name} (${entity.type}): ${getEntityText(entity)}`,
      searchableText: [
        entity.id,
        entity.type,
        entity.name,
        getEntityText(entity),
        entity.founder || "",
        entity.builder || "",
        entity.field || "",
        entity.stage || "",
        entity.vision || "",
        entity.problem_statement || "",
        entity.unfair_advantages || "",
        entity.market_opportunity || "",
        entity.key_technologies?.join(" ") || "",
        ...entity.tags
      ]
        .filter(Boolean)
        .join(" "),
      score: 0
    }));

    const relationshipHits = graph.relationships.map<GraphSearchHit>(
      (relationship) => ({
        id: `${relationship.source}-${relationship.type}-${relationship.target}`,
        kind: "relationship",
        type: relationship.type,
        label: `${entityNameById.get(relationship.source) || relationship.source} ${relationship.type.replace(/_/g, " ")} ${entityNameById.get(relationship.target) || relationship.target}`,
        text: relationship.summary,
        searchableText: [
          relationship.source,
          relationship.target,
          entityNameById.get(relationship.source) || "",
          entityNameById.get(relationship.target) || "",
          relationship.type,
          relationship.summary
        ].join(" "),
        score: 0
      })
    );

    const memoryHits = graph.memories.map<GraphSearchHit>((memory) => ({
      id: memory.id,
      kind: "memory",
      type: "memory",
      label: memory.title,
      text: `${memory.title}: ${memory.text}`,
      searchableText: [
        memory.id,
        memory.title,
        memory.text,
        ...memory.entities,
        ...memory.tags
      ].join(" "),
      score: 0
    }));

    return [personHit, ...entityHits, ...relationshipHits, ...memoryHits];
  });
}

function scoreGraphHit(
  hit: GraphSearchHit,
  graphQuery: GraphQuery,
  question: string
) {
  const normalizedSearchableText = normalizeQuestion(hit.searchableText);
  const normalizedLabel = normalizeQuestion(hit.label);
  const terms = tokenize(question);
  let score = terms.reduce(
    (total, term) =>
      total + (termMatches(term, tokenize(hit.searchableText)) ? 1 : 0),
    0
  );

  if (graphQuery.nodeTypes.includes(hit.type)) {
    score += 4;
  }

  if (graphQuery.nodeTypes.includes(hit.kind)) {
    score += 3;
  }

  if (graphQuery.relationshipTypes.includes(hit.type)) {
    score += 5;
  }

  for (const entity of graphQuery.entities) {
    const isBroadPersonReference = entity === "keshav";

    if (
      hit.id === entity ||
      textHasAlias(normalizedLabel, entity)
    ) {
      score += 4;
    } else if (
      !isBroadPersonReference &&
      textHasAlias(normalizedSearchableText, entity)
    ) {
      score += 4;
    } else if (
      isBroadPersonReference &&
      hit.kind === "relationship" &&
      textHasAlias(normalizedSearchableText, entity)
    ) {
      score += 1;
    }
  }

  for (const topic of graphQuery.topics) {
    if (textHasAlias(normalizedSearchableText, topic)) {
      score += 3;
    }
  }

  if (hit.kind === "memory") {
    score += 1.5;
  }

  if (graphQuery.intent === "find_project" && hit.type === "project") {
    score += 4;
  }

  if (graphQuery.intent === "find_skill" && hit.type === "expertise") {
    score += 4;
  }

  if (graphQuery.intent === "find_education") {
    if (
      textHasAlias(normalizedSearchableText, "phd") ||
      textHasAlias(normalizedSearchableText, "mcmaster") ||
      textHasAlias(normalizedSearchableText, "biochemistry")
    ) {
      score += 8;
    } else if (hit.type !== "experience" && hit.type !== "institution") {
      score -= 4;
    }
  }

  if (graphQuery.intent === "find_current") {
    if (
      textHasAlias(normalizedSearchableText, "currently") ||
      textHasAlias(normalizedSearchableText, "current focus") ||
      textHasAlias(normalizedSearchableText, "building EndoBio")
    ) {
      score += 8;
    }
  }

  if (
    graphQuery.intent === "explain_connection" &&
    hit.kind === "relationship"
  ) {
    score += 4;
  }

  return score;
}

function searchGraphWithQuery(
  question: string,
  memoryGraph: MemoryGraph[],
  graphQuery = buildGraphQuery(question, memoryGraph)
) {
  const hits = graphToSearchHits(memoryGraph)
    .map((hit) => ({
      ...hit,
      score: scoreGraphHit(hit, graphQuery, question)
    }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);

  return { graphQuery, hits };
}

function formatGraphFacts(hits: GraphSearchHit[]) {
  return hits.map((hit) => `${hit.kind}: ${hit.label}: ${hit.text}`);
}

function truncateSentence(value: string, maxLength = 190) {
  const trimmedValue = value.trim();

  if (trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
}

function dedupeHits(hits: GraphSearchHit[]) {
  const seenLabels = new Set<string>();

  return hits.filter((hit) => {
    const key = normalizeQuestion(hit.label);

    if (seenLabels.has(key)) {
      return false;
    }

    seenLabels.add(key);
    return true;
  });
}

function cleanHitText(hit: GraphSearchHit) {
  let text = hit.text.trim();
  const label = hit.label.trim();

  if (text.startsWith(`${label}:`)) {
    text = text.slice(label.length + 1).trim();
  }

  if (text.startsWith(`${label} (`)) {
    const descriptionStart = text.indexOf(":");

    if (descriptionStart !== -1) {
      text = text.slice(descriptionStart + 1).trim();
    }
  }

  return truncateSentence(text);
}

function buildGroundedGraphAnswer(graphSearch: {
  graphQuery: GraphQuery;
  hits: GraphSearchHit[];
}) {
  const topHits = dedupeHits(graphSearch.hits).slice(0, 3);

  if (topHits.length === 0) {
    return null;
  }

  const introByIntent: Record<GraphQuery["intent"], string> = {
    find_person: "Here is what I found in the graph:",
    find_project: "I found these project/product signals in the graph:",
    find_skill: "I found these skill signals in the graph:",
    find_experience: "I found these experience signals in the graph:",
    find_education: "Here is what the graph says about Keshav's education:",
    find_current: "Here is what Keshav is currently focused on:",
    explain_connection: "I found these graph connections:",
    search_all: "I found these relevant graph hits:"
  };

  const facts = topHits
    .map((hit) => `${hit.label}: ${cleanHitText(hit)}`)
    .join("\n");

  return {
    content: `${introByIntent[graphSearch.graphQuery.intent]}\n${facts}`,
    confidence: "high" as const
  };
}

function normalizeQuestion(question: string) {
  return question
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function formatName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getIntroducedName(question: string) {
  const match = question
    .trim()
    .match(/^(?:my name is|i am|i'm|im|call me)\s+([a-z][a-z0-9_-]{0,24})\.?$/i);

  return match ? formatName(match[1]) : null;
}

function getSmallTalkAnswer(question: string, userName: string | null) {
  const normalizedQuestion = normalizeQuestion(question);

  const introducedName = getIntroducedName(question);
  if (introducedName) {
    return {
      content: `Nice to meet you, ${introducedName}.`,
      introducedName
    };
  }

  if (/^(what is my name|who am i|do you know my name)$/.test(normalizedQuestion)) {
    return {
      content: userName
        ? `You told me your name is ${userName}.`
        : "I don't know your name yet.",
      introducedName: null
    };
  }

  if (
    /^(hi|hello|hey|yo|hiya|sup|good morning|good afternoon|good evening)$/.test(
      normalizedQuestion
    )
  ) {
    return {
      content: `Hey${userName ? `, ${userName}` : ""}! I'm here. Ask me anything about Keshav, or just throw me a tiny conversational curveball.`,
      introducedName: null
    };
  }

  if (/^(thanks|thank you|thx|ty|appreciate it)$/.test(normalizedQuestion)) {
    return { content: "Anytime.", introducedName: null };
  }

  if (
    /^(how are you|how s it going|how is it going|what s up|whats up)$/.test(
      normalizedQuestion
    )
  ) {
    return {
      content:
        "I'm doing pretty well for a small local model. Curious, slightly over-caffeinated in spirit, and ready to talk Keshav.",
      introducedName: null
    };
  }

  if (/^(what|what\?|huh|huh\?|sorry\?)$/.test(normalizedQuestion)) {
    return {
      content:
        "I got tangled there. Ask me a full question about Keshav, or just talk to me normally and I'll keep up.",
      introducedName: null
    };
  }

  if (/^(poop|lol|lmao|haha|test)$/.test(normalizedQuestion)) {
    return {
      content:
        "A bold data point. I can chat a little, but I'm mostly useful for Keshav questions.",
      introducedName: null
    };
  }

  return null;
}

function getEntityText(entity: MemoryGraph["entities"][number]) {
  return entity.summary || entity.description || "";
}

function findMentionedEntity(question: string, memoryGraph: MemoryGraph[]) {
  const normalizedQuestion = normalizeQuestion(question);

  for (const graph of memoryGraph) {
    const entity = graph.entities.find((candidate) => {
      const entityNames = [
        candidate.id,
        candidate.name
      ].map(normalizeQuestion);

      return entityNames.some((entityName) =>
        normalizedQuestion.includes(entityName)
      );
    });

    if (entity) {
      return entity;
    }
  }

  return null;
}

function getDirectGraphAnswer(question: string, memoryGraph: MemoryGraph[]) {
  const lowerQuestion = question.toLowerCase();
  const mentionedEntity = findMentionedEntity(question, memoryGraph);
  const entityText = mentionedEntity ? getEntityText(mentionedEntity) : "";

  if (
    mentionedEntity &&
    entityText &&
    (lowerQuestion.includes("who") || lowerQuestion.includes("what"))
  ) {
    return {
      content: `I think ${mentionedEntity.name} is ${entityText}`,
      confidence: "high" as const
    };
  }

  return null;
}

function getKnownFactAnswer(question: string, memoryGraph: MemoryGraph[]) {
  const normalizedQuestion = normalizeQuestion(question);
  const graph = memoryGraph[0];

  if (/\b(dog|pet|puppy)\b/.test(normalizedQuestion)) {
    const dog = graph.entities.find((entity) =>
      getEntityText(entity).toLowerCase().includes("dog")
    );

    if (dog) {
      return {
        content: `Keshav's dog is ${dog.name}.`,
        confidence: "high" as const
      };
    }
  }

  if (/\b(colou?r|favorite|favourite)\b/.test(normalizedQuestion)) {
    const colorMemory = graph.memories.find(
      (memory) =>
        memory.id.includes("color") ||
        memory.title.toLowerCase().includes("color")
    );
    const color = colorMemory?.text.match(
      /favou?rite colou?r is ([^.]+)\./i
    )?.[1];

    if (color) {
      return {
        content: `Keshav's favorite color is ${color}.`,
        confidence: "high" as const
      };
    }
  }

  return null;
}

function getCorrectionAnswer(
  question: string,
  memoryGraph: MemoryGraph[],
  messages: Message[]
) {
  const normalizedQuestion = normalizeQuestion(question);

  if (!/\b(why|wait|but|wrong|max)\b/.test(normalizedQuestion)) {
    return null;
  }

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (!lastAssistantMessage?.content.toLowerCase().includes("max")) {
    return null;
  }

  const dogAnswer = getKnownFactAnswer("what is keshav's dog name", memoryGraph);

  if (!dogAnswer) {
    return null;
  }

  return {
    content: `I shouldn't have said Max. ${dogAnswer.content}`,
    confidence: dogAnswer.confidence
  };
}

function cleanModelAnswer(answer: string) {
  const trimmedAnswer = answer.trim();
  const lowerAnswer = trimmedAnswer.toLowerCase();
  const confidenceMatch = trimmedAnswer.match(
    /(?:^|\n)\s*confidence:\s*(low|medium|high)\.?\s*$/i
  );
  const confidence = confidenceMatch?.[1]?.toLowerCase() as
    | Message["confidence"]
    | undefined;
  const contentWithoutConfidence = confidenceMatch
    ? trimmedAnswer.replace(confidenceMatch[0], "").trim()
    : trimmedAnswer;
  const leakedInstructionPhrases = [
    "do not infer",
    "embellish",
    "outside knowledge",
    "keep answers short",
    "when you answer from partial evidence",
    "provided memory graph excerpts",
    "confidence line such as"
  ];

  if (!trimmedAnswer) {
    return { content: UNKNOWN_ANSWER };
  }

  if (leakedInstructionPhrases.some((phrase) => lowerAnswer.includes(phrase))) {
    return { content: UNKNOWN_ANSWER };
  }

  if (
    lowerAnswer.includes("i don't know that yet") ||
    lowerAnswer.includes("i do not know that yet")
  ) {
    return { content: UNKNOWN_ANSWER };
  }

  return {
    content: contentWithoutConfidence || UNKNOWN_ANSWER,
    confidence
  };
}

function buildRecentConversation(messages: Message[]) {
  return messages
    .filter((message) => message.content !== initialMessage.content)
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function shouldUseConversationHistory(question: string) {
  const normalizedQuestion = normalizeQuestion(question);

  return (
    /^(what about|why|wait|but|and|also|tell me more|more|how so|what\?|huh)/.test(
      normalizedQuestion
    ) ||
    /\b(that|this|it|they|them|previous|earlier)\b/.test(normalizedQuestion)
  );
}

function getNoContextAnswer(question: string) {
  const normalizedQuestion = normalizeQuestion(question);

  if (
    /\b(keshav|endobio|sanofi|beauty|project|work|job|phd|color|colour|favorite|favourite)\b/.test(
      normalizedQuestion
    )
  ) {
    return UNKNOWN_ANSWER;
  }

  return "I don't have a memory hit for that yet. I'm best at Keshav questions, light chat, and the occasional odd little fact.";
}

function AssistantInfo() {
  return (
    <details className="assistant-info">
      <summary aria-label="About Keshav Jr.">ⓘ</summary>
      <div className="assistant-info-popover">
        <p>
          Keshav Jr. is a small browser-based AI with access to a limited
          memory graph and FAQ. If I don’t know the answer, try asking Keshav
          Sr. directly.
        </p>
        <a href="mailto:keshav.dial@gmail.com">📧 Email Keshav</a>
      </div>
    </details>
  );
}

export default function AskKeshavChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [status, setStatus] = useState("Ready");
  const [isAnswering, setIsAnswering] = useState(false);
  const [loadProgress, setLoadProgress] = useState("");
  const [loadPercent, setLoadPercent] = useState<number | null>(null);
  const [showBrain, setShowBrain] = useState(false);
  const memoryGraphRef = useRef<MemoryGraph[] | null>(null);
  const engineRef = useRef<WebLLMEngine | null>(null);
  const userNameRef = useRef<string | null>(null);

  const canSubmit = useMemo(
    () => input.trim().length > 0 && !isAnswering,
    [input, isAnswering]
  );

  async function loadMemoryGraph() {
    if (memoryGraphRef.current) {
      return memoryGraphRef.current;
    }

    const response = await fetch("/data/keshav-kb.json");
    if (!response.ok) {
      throw new Error("Could not load Keshav Jr.'s memory graph.");
    }

    const data = (await response.json()) as MemoryGraph;
    const graphs = [data];
    memoryGraphRef.current = graphs;
    return graphs;
  }

  async function loadEngine() {
    if (engineRef.current) {
      return engineRef.current;
    }

    if (!("gpu" in navigator)) {
      throw new Error("WebLLM needs WebGPU support in this browser.");
    }

    setStatus("Loading local model");
    setLoadPercent(0);
    const webllm = await import("@mlc-ai/web-llm");
    const engine = (await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => {
        setLoadProgress(report.text);
        setLoadPercent(Math.round(report.progress * 100));
      }
    })) as WebLLMEngine;

    engineRef.current = engine;
    setStatus("Model ready");
    setLoadPercent(null);
    return engine;
  }

  async function askQuestion(question: string) {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || isAnswering) {
      return;
    }

    setInput("");
    setIsOpen(true);
    setIsAnswering(true);
    setMessages((current) => [
      ...current,
      { role: "user", content: trimmedQuestion }
    ]);

    try {
      const smallTalkAnswer = getSmallTalkAnswer(
        trimmedQuestion,
        userNameRef.current
      );

      if (smallTalkAnswer) {
        if (smallTalkAnswer.introducedName) {
          userNameRef.current = smallTalkAnswer.introducedName;
        }

        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: smallTalkAnswer.content
          }
        ]);
        setStatus("Ready");
        return;
      }

      const memoryGraph = await loadMemoryGraph();
      const correctionAnswer = getCorrectionAnswer(
        trimmedQuestion,
        memoryGraph,
        messages
      );

      if (correctionAnswer) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: correctionAnswer.content,
            confidence: correctionAnswer.confidence
          }
        ]);
        setStatus("Ready");
        return;
      }

      const knownFactAnswer = getKnownFactAnswer(trimmedQuestion, memoryGraph);

      if (knownFactAnswer) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: knownFactAnswer.content,
            confidence: knownFactAnswer.confidence
          }
        ]);
        setStatus("Ready");
        return;
      }

      const directAnswer = getDirectGraphAnswer(trimmedQuestion, memoryGraph);

      if (directAnswer) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: directAnswer.content,
            confidence: directAnswer.confidence
          }
        ]);
        setStatus("Ready");
        return;
      }

      const graphSearch = searchGraphWithQuery(trimmedQuestion, memoryGraph);
      const facts = formatGraphFacts(graphSearch.hits);

      if (facts.length === 0) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: getNoContextAnswer(trimmedQuestion)
          }
        ]);
        setStatus("Ready");
        return;
      }

      const groundedGraphAnswer = buildGroundedGraphAnswer(graphSearch);

      if (groundedGraphAnswer) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: groundedGraphAnswer.content,
            confidence: groundedGraphAnswer.confidence
          }
        ]);
        setStatus("Ready");
        return;
      }

      const engine = await loadEngine();

      setStatus("Thinking");
      const recentConversation = shouldUseConversationHistory(trimmedQuestion)
        ? buildRecentConversation(messages)
        : [];
      const response = await engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are Ask Keshav Jr., Keshav's warm, curious, slightly playful local AI assistant.\nBehavior:\n- Answer the current question, not an earlier topic.\n- Be natural with greetings, follow-ups, and light conversation.\n- Answer in 1-3 concise sentences.\n- Use recent conversation only when the current question is clearly a follow-up.\n- For factual claims about Keshav, his projects, work, background, or preferences, use only the structured graph search results as your source of truth.\n- If the graph results do not contain relevant information for a factual question, say you don't know yet and suggest asking Keshav Sr.\n- Do not invent biographical facts, project details, dates, employers, preferences, or accomplishments.\n- If evidence is partial, say what you can infer and keep the confidence modest."
          },
          ...recentConversation,
          {
            role: "user",
            content: `Structured graph query:\n${JSON.stringify(graphSearch.graphQuery, null, 2)}\n\nGraph search results:\n${facts.map((fact) => `- ${fact}`).join("\n")}\n\nCurrent question: ${trimmedQuestion}`
          }
        ],
        max_tokens: 110,
        temperature: 0.25
      });

      const answer = cleanModelAnswer(
        response.choices[0]?.message?.content || ""
      );

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: answer.content,
          confidence: answer.confidence
        }
      ]);
      setStatus("Ready");
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : "Something went wrong.";
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: fallback
        }
      ]);
      setStatus("Ready");
    } finally {
      setIsAnswering(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await askQuestion(input);
  }

  return (
    <div className="ask-keshav">
      {!isOpen ? (
        <section className="ask-invitation" aria-label="Ask Keshav Jr.">
          <div className="assistant-title-row">
            <h2>🤖 Ask Keshav Jr.</h2>
            <AssistantInfo />
          </div>
          <p>A tiny local AI trained on his projects, writing, and lore.</p>

          <form className="ask-invitation-form" onSubmit={handleSubmit}>
            <input
              aria-label="Ask Keshav a question"
              autoComplete="off"
              placeholder="What is Keshav building?"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button disabled={!canSubmit} type="submit">
              Ask
            </button>
          </form>

          <div className="prompt-chips" aria-label="Suggested questions">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => askQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="chat-panel" aria-label="Ask Keshav Jr. chat">
          <header className="chat-header">
            <div>
              <div className="assistant-title-row">
                <h2>🤖 Ask Keshav Jr.</h2>
                <AssistantInfo />
              </div>
              <p>{loadProgress || status}</p>
              {loadPercent !== null ? (
                <div
                  aria-label="Model loading progress"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={loadPercent}
                  className="model-progress"
                  role="progressbar"
                >
                  <span style={{ width: `${loadPercent}%` }} />
                  <strong>{loadPercent}%</strong>
                </div>
              ) : null}
            </div>
            <button
              aria-label="Close Ask Keshav"
              className="chat-close"
              type="button"
              onClick={() => setIsOpen(false)}
            >
              x
            </button>
          </header>

          <div className="chat-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`chat-message ${message.role}`} key={index}>
                <span>{message.content}</span>
                {message.confidence ? (
                  <span className={`confidence-badge ${message.confidence}`}>
                    Confidence: {message.confidence}
                  </span>
                ) : null}
              </div>
            ))}
            {isAnswering ? (
              <div className="chat-message assistant">Thinking...</div>
            ) : null}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              aria-label="Ask Keshav a question"
              autoComplete="off"
              placeholder="Ask about breakfast, colours, fridges..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button disabled={!canSubmit} type="submit">
              Ask
            </button>
          </form>

          <footer className="chat-brain-link">
            <span>────────────────────</span>
            <button type="button" onClick={() => setShowBrain(true)}>
              🧠 Wanna see my brain?
            </button>
            <a
              className="raw-memory-link"
              href="/data/keshav-kb.json"
              target="_blank"
              rel="noreferrer"
            >
              Raw JSON
            </a>
          </footer>
        </section>
      )}
      {showBrain ? (
        <div
          aria-label="Keshav Jr. brain modal"
          className="brain-modal-backdrop"
          role="dialog"
        >
          <div className="brain-modal">
            <header className="brain-modal-header">
              <div>
                <h3>🧠 Keshav Jr.’s Brain</h3>
                <p>Glowing memory nodes clustered by relationships.</p>
              </div>
              <button
                aria-label="Close brain"
                className="brain-modal-close"
                type="button"
                onClick={() => setShowBrain(false)}
              >
                x
              </button>
            </header>
            <MemoryGraphBrain />
          </div>
        </div>
      ) : null}
    </div>
  );
}
