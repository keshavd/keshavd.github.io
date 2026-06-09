# Ask Keshav Jr. Test Suite

This test suite validates that the chatbot knowledge base has all the information needed to answer investor questions.

## What's Being Tested

### 1. **Personal & Background Questions**
- Who are you?
- What's your background?
- Why are you qualified?
- Biochemistry + AI combination

### 2. **EndoBio Product & Market**
- What is EndoBio?
- What problem does it solve?
- What makes it different?
- Technology stack
- 7-14 day early detection window
- Market opportunity
- Why agriculture? Why now?

### 3. **Track Record & Execution**
- What have you built before?
- Sanofi Concierge
- Knowledge management system with Claude
- Product scaling story
- Team leadership

### 4. **Expertise & Technical Skills**
- Machine Learning
- Knowledge Graphs
- Modern Data Infrastructure (Snowflake, Qdrant, Pinecone, Neo4j)
- Infrastructure as Code (Terraform)
- Career progression

### 5. **Values & Mission**
- Agriculture focus
- Paradigm-breaking philosophy
- EndoBio founding story

### 6. **Knowledge Base Completeness**
- Minimum number of entities
- Minimum number of memories
- Minimum number of relationships
- Rich descriptions for all entities

## Running the Tests

### Setup
First, install Vitest:
```bash
npm install --save-dev vitest
```

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npm test AskKeshavChat.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage
```

### Watch Mode (auto-rerun on changes)
```bash
npm test -- --watch
```

## Test Structure

Each test validates:
1. **Entity existence** - Does the KB have the required entities?
2. **Entity properties** - Do entities have descriptions, specializations?
3. **Relationships** - Are entities properly connected?
4. **Memories** - Are there narratives explaining complex topics?
5. **Content quality** - Do descriptions have sufficient detail?

## What This Validates For Investors

These tests ensure that when an investor asks about:
- **Background** → KB has education, experience, expertise
- **EndoBio** → KB has product details, market size, differentiation
- **Track Record** → KB documents Sanofi projects and scaling
- **Technology** → KB lists modern tools and infrastructure approach
- **Values** → KB explains why agriculture matters

## Adding New Tests

To test a new investor question:

1. Add test case to appropriate `describe` block
2. Check for required entities with `hasEntity(kb, "entity-id")`
3. Check for relationships with `hasRelationship(kb, source, target)`
4. Check for memory topics with `hasMemoryAbout(kb, "keyword")`
5. Verify entity properties (description, vision, etc.)

Example:
```typescript
it("should answer 'What is your competitive advantage?'", () => {
  expect(hasMemoryAbout(kb, "unfair advantage")).toBe(true);
  expect(hasEntity(kb, "expertise-biomedical-ai")).toBe(true);
});
```

## Test Coverage Goals

- ✅ All investor questions covered
- ✅ KB completeness validated
- ✅ Entity relationships verified
- ✅ Content quality checked
- ✅ Memory narratives present

## Continuous Integration

These tests can be added to your GitHub Actions workflow to validate the KB on every push:

```yaml
- name: Run KB Tests
  run: npm test
```

This ensures that any changes to the knowledge base don't break investor question answering capability.
