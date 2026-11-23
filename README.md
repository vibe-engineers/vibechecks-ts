<p align="center">
  <img width="300" src="assets/vibechecks.png" alt="VibeChecks logo" />
</p>
<h1 align="center">VibeChecks</h1>

<p align="center">
  <a href="https://github.com/vibe-engineers/vibechecks-ts/actions/workflows/ci.yml"><img src="https://github.com/vibe-engineers/vibechecks-ts/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@vibe-engineers/vibechecks"><img src="https://img.shields.io/npm/v/@vibe-engineers/vibechecks" alt="npm version" /></a>
  <a href="https://github.com/vibe-engineers/vibechecks-ts/blob/main/package.json"><img src="https://img.shields.io/badge/node-%3E%3D22.13.0-43853d" alt="Node.js 22.13 or later" /></a>
  <a href="https://github.com/vibe-engineers/vibechecks-ts/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
  <a href="https://www.npmjs.com/package/@vibe-engineers/vibechecks"><img src="https://img.shields.io/npm/dm/@vibe-engineers/vibechecks" alt="Monthly npm downloads" /></a>
</p>

## Table of Contents

- [Introduction](#introduction)
- [Using Jev](#using-jev)
- [Using WebLLM in a browser](#using-webllm-in-a-browser)
- [Features](#features)
- [Technologies](#technologies)
- [Team](#team)
- [Contributing](#contributing)
- [Others](#others)

### Introduction

**VibeChecks** is a lightweight TypeScript package that lets you use natural language in an `if` statement or a loop. Give `VibeCheck` a provider client or browser engine and a model name, then `await` each check to get its boolean result. This example asks for a dog breed and checks whether it is valid. Set `GEMINI_API_KEY` in your environment to run it.

```ts
import { stdin, stdout } from "node:process"
import { createInterface } from "node:readline/promises"
import { GoogleGenAI } from "@google/genai"
import { VibeCheck } from "@vibe-engineers/vibechecks"

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) throw new Error("Set GEMINI_API_KEY to run this example.")
const client = new GoogleGenAI({ apiKey })
const vc = VibeCheck(client, "gemini-3.1-flash-lite")

const input = createInterface({ input: stdin, output: stdout })
try {
  const breed = await input.question("Enter a dog breed: ")
  if (await vc(`${breed} is a valid dog breed`)) {
    console.log(`${breed} is a valid dog breed!`)
  } else {
    console.log(`${breed} is not a valid dog breed!`)
  }
} finally {
  input.close()
}
```

Install VibeChecks with the SDK for your provider.

```sh
# Google Gemini
npm install @vibe-engineers/vibechecks "@google/genai@^3.6.1"

# OpenAI
npm install @vibe-engineers/vibechecks "openai@^7.62.0"

# TypeSafe Jev
npm install @vibe-engineers/vibechecks "@typesafe-ai/sdk@^0.7.0"
```

For setup from source, interactive examples, and the available APIs, see the [Developer Guide](docs/DeveloperGuide.md).

### Using Jev

Set `TYPESAFE_API_KEY` in your environment. With Jev, `await check(statement)` returns `true` when the probability exceeds `0.5` by default. To choose another cutoff, pass `probability_threshold` in the optional third argument when creating the check. The example requires a probability above `0.8`. [TypeSafe JavaScript SDK](https://github.com/typesafe-ai/typesafe-sdk-js)

```ts
import { TypeSafeClient } from "@typesafe-ai/sdk"
import { VibeCheck } from "@vibe-engineers/vibechecks"

const check = VibeCheck(new TypeSafeClient(), "jev-1.14.0", { probability_threshold: 0.8 })
console.log(await check("A border collie is a herding dog."))
```

To read the raw estimate, use `await check.probability(statement)`. If you need both the estimate and the verdict, compare that same value to your cutoff to evaluate the statement only once.

### Using WebLLM in a browser

Browser support starts with VibeChecks 0.1.1. Install the package and WebLLM in your browser app.

```sh
npm install "@vibe-engineers/vibechecks@^0.1.1" "@mlc-ai/web-llm@^0.2.89"
```

Run your app over HTTPS or localhost in a browser with WebGPU. WebLLM downloads the selected model on first use and runs checks locally. Initialize the engine once and reuse it. Check your model on known true and false statements from your use case. [WebLLM](https://github.com/mlc-ai/web-llm)

```ts
import { CreateMLCEngine } from "@mlc-ai/web-llm"
import { VibeCheck } from "@vibe-engineers/vibechecks"

const model = "Llama-3.2-1B-Instruct-q4f16_1-MLC"
const engine = await CreateMLCEngine(model)
const check = VibeCheck(engine, model)
console.log(await check("A border collie is a dog."))
```

### Features

- **Natural language conditions.** Use `await vc(statement)` anywhere you need a boolean, including `if` and `while` conditions.
- **Multi-provider support.** Pass an OpenAI, Google Gemini, or Jev client on Node, or an initialized WebLLM engine in a browser.
- **Extensible design.** VibeTools holds the provider adapters. VibeChecks lets you customize the system instruction, timeout, and retry mode.
- **Custom exceptions.** Distinguish a timeout, invalid input, a provider failure, and a response that could not be parsed. [Error handling](docs/DeveloperGuide.md#vibecheck-facade)

### Technologies

##### Done with

<p align="center">
  <img height="150" width="150" src="https://www.typescriptlang.org/branding/ts-logo-128.svg" alt="TypeScript logo" />
</p>
<p align="center">TypeScript on Node.js 22.13 or later and WebGPU-capable browsers</p>

##### Project Repository

[vibe-engineers/vibechecks-ts](https://github.com/vibe-engineers/vibechecks-ts) · [Python implementation](https://github.com/vibe-engineers/vibechecks)

### Team

- [Kong Le-Yi](https://github.com/konglyyy)
- [Tan Jin](https://github.com/tjtanjin)

### Contributing

To contribute to VibeChecks, fork the repository and open a pull request describing the change and how you tested it. The repository includes issue and pull request templates. [Developer Guide](docs/DeveloperGuide.md) · [Contributing](CONTRIBUTING.md)

For bugs or suggestions, open an issue or discuss it with the team on Discord. [GitHub issues](https://github.com/vibe-engineers/vibechecks-ts/issues) · [Community Discord](https://discord.gg/dBW35GBCPZ)

### Others

For implementation questions, reach the team on Discord. To report a vulnerability privately, follow the security policy. [Community Discord](https://discord.gg/dBW35GBCPZ) · [Security policy](SECURITY.md)
