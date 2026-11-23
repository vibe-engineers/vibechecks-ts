# Changelog

## 0.1.0

- Added an optional Jev client for boolean checks, `probability_threshold` to configure their cutoff (default `> 0.5`), and `await check.probability(statement)` for the model's probability.
- Replacing a check's `llm` updates how it evaluates statements and whether it exposes `probability`.
- Ported the callable `VibeCheck` interface and `VibeCheckConfig` to TypeScript. Each check returns a promise that resolves to a boolean or rejects with the evaluation error, including when the evaluator throws synchronously.
- Added public callable types so consuming libraries can export configured instances in their TypeScript declarations.
- Added Node.js examples for checking a dog breed with OpenAI or Gemini.
- Added an offline comparison against the sibling Python packages for verdicts and error types.
