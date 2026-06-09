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
    summary: string;
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

type KBDocument = {
  id: string;
  label: string;
  text: string;
  vector: number[];
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
        messages: Array<{ role: "system" | "user"; content: string }>;
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
  content: "My training data is mostly stories, projects, and random facts."
};

const greetings = new Set(["hello", "hi", "hey", "howdy", "greetings", "sup", "yo"]);

function isGreeting(question: string): boolean {
  return greetings.has(question.toLowerCase().split(/\s+/)[0]);
}

const suggestedPrompts = [
  "What is Keshav building?",
  "Why EndoBio?",
  "Sanofi",
  "Projects"
];

function graphToKBDocuments(memoryGraph: MemoryGraph[]): Omit<KBDocument, "vector">[] {
  return memoryGraph.flatMap((graph) => {
    const docs: Omit<KBDocument, "vector">[] = [];

    // Person document
    docs.push({
      id: graph.person.id,
      label: `Person: ${graph.person.name}`,
      text: `${graph.person.name} is ${graph.person.headline}. Current focus: ${graph.person.current_focus.join(", ")}. ${graph.person.bio || ""}`
    });

    // Entity documents
    graph.entities.forEach((entity) => {
      docs.push({
        id: entity.id,
        label: `Entity: ${entity.name}`,
        text: `${entity.name} (${entity.type}): ${entity.description || entity.summary}. ${entity.vision || ""} ${entity.problem_statement || ""} ${entity.unfair_advantages || ""} ${entity.market_opportunity || ""}`
      });
    });

    // Relationship documents
    graph.relationships.forEach((relationship) => {
      docs.push({
        id: `rel-${relationship.source}-${relationship.target}`,
        label: `Relationship: ${relationship.source} ${relationship.type} ${relationship.target}`,
        text: `${relationship.source} ${relationship.type} ${relationship.target}: ${relationship.summary}`
      });
    });

    // Memory documents (richer content)
    graph.memories.forEach((memory) => {
      docs.push({
        id: memory.id,
        label: `Memory: ${memory.title}`,
        text: `${memory.title}: ${memory.text}`
      });
    });

    return docs;
  });
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const { pipeline } = await import("@xenova/transformers");
  const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  const embeddings = await embedder(texts, { pooling: "mean" });

  // Convert to array of arrays
  return Array.from(embeddings.data).reduce((chunks: number[][], _, i, arr) => {
    if (i % 384 === 0) {
      chunks.push(Array.from(arr.slice(i, i + 384)));
    }
    return chunks;
  }, []);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
  const dbRef = useRef<any>(null);
  const documentsRef = useRef<KBDocument[] | null>(null);

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

  async function initializeVectorDB() {
    if (dbRef.current) {
      return dbRef.current;
    }

    setStatus("Building search index");
    const memoryGraph = await loadMemoryGraph();
    const docs = graphToKBDocuments(memoryGraph);

    // Embed all documents
    const texts = docs.map((d) => d.text);
    const embeddings = await embedTexts(texts);
    const docsWithVectors: KBDocument[] = docs.map((doc, i) => ({
      ...doc,
      vector: embeddings[i]
    }));

    documentsRef.current = docsWithVectors;
    dbRef.current = { initialized: true };
    setStatus("Ready");
    return dbRef.current;
  }

  async function searchVectorDB(question: string): Promise<string[]> {
    if (!dbRef.current) {
      await initializeVectorDB();
    }

    const questionEmbedding = (await embedTexts([question]))[0];
    const docs = documentsRef.current!;

    const scored = docs.map((doc) => ({
      doc,
      similarity: cosineSimilarity(questionEmbedding, doc.vector)
    }));

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map((s) => `${s.doc.label}: ${s.doc.text}`);
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
      // Handle greetings
      if (isGreeting(trimmedQuestion)) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: "Hey! I'm Keshav Jr., a local AI assistant. Ask me about Keshav, EndoBio, his work, or anything else in my knowledge base!"
          }
        ]);
        setStatus("Ready");
        return;
      }

      const facts = await searchVectorDB(trimmedQuestion);

      if (facts.length === 0) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: UNKNOWN_ANSWER
          }
        ]);
        setStatus("Ready");
        return;
      }

      const engine = await loadEngine();

      setStatus("Thinking");
      const response = await engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are Ask Keshav Jr., Keshav's earnest AI assistant.\nRules:\n- You MUST answer based on the memory graph excerpts provided. Do not refuse to answer.\n- If the question mentions an entity or topic and we have excerpts about it, answer directly using those excerpts.\n- Keep answers concise (1-2 sentences).\n- When answering from evidence: can add 'Confidence: high/medium/low' if appropriate.\n- Never use outside knowledge or make up facts."
          },
          {
            role: "user",
            content: `Memory graph excerpts:\n${facts.map((fact) => `- ${fact}`).join("\n")}\n\nQuestion: ${trimmedQuestion}`
          }
        ],
        max_tokens: 80,
        temperature: 0.2
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
