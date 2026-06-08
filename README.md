# keshavd.github.io

Personal site for [www.keshav.ai](https://www.keshav.ai), built with Vite and React.

## Development

```bash
npm install
npm run dev
```

The "Ask Keshav" panel uses `@mlc-ai/web-llm` in the browser. The model is lazy-loaded only after someone opens the panel and submits a question, and the current knowledge base lives at `public/data/keshav-kb.json`.

## Build

```bash
npm run build
```

The static build is generated in `dist/`.

## TODO

- Add slidable resume
- Add projects
