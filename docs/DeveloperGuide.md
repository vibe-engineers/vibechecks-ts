<p align="center">
  <img width="220" src="../assets/vibechecks.png" alt="VibeChecks logo" />
</p>
<h1 align="center">VibeChecks Developer Guide</h1>

## Table of Contents

- [Introduction](#introduction)
- [Navigating this Developer Guide](#navigating-this-developer-guide)
- [Setup](#setup)
- [Project Structure](#project-structure)
- [Key Concepts & Design](#key-concepts--design)
- [Code Documentation](#code-documentation)
- [Testing](#testing)
- [Pull Requests](#pull-requests)
- [Final Notes](#final-notes)

## Introduction

VibeChecks turns a statement into an asynchronous boolean condition. This package defines the callable, its default instruction, and its logger. Its required dependency, `@vibe-engineers/vibetools`, handles the provider request and interprets the response. [VibeChecks README](../README.md) · [Package manifest](../package.json)

## Navigating this Developer Guide

Run the commands in this guide from the root of the VibeChecks TypeScript repository. All project paths below are relative to that directory. [vibe-engineers/vibechecks-ts](https://github.com/vibe-engineers/vibechecks-ts)

## Setup

Use Node.js 22.13 or later. Once the locked VibeTools version is available on npm, install the dependencies and run the tests.

```sh
npm ci
npm test
```

Before the first VibeTools release, clone `vibe-engineers/vibetools-ts` alongside this repository and install its local tarball. These commands build the dependency and install it together with the VibeChecks development tools. [VibeTools repository](https://github.com/vibe-engineers/vibetools-ts)

```sh
npm ci --prefix ../vibetools-ts
(cd ../vibetools-ts && npm pack)
npm install --no-save ../vibetools-ts/vibe-engineers-vibetools-0.1.0.tgz
npm test
```

For the first release, publish VibeTools before VibeChecks. The VibeChecks lockfile records the checksum of the candidate VibeTools archive. If the published archive differs, refresh its lockfile entry. Verify `npm ci`, `npm test`, and `npm run test:parity` against the published dependency before releasing VibeChecks.

### Live examples

For the interactive OpenAI and Gemini examples, copy `.env.template` to `.env` after building or running the tests. Set one provider key and run the corresponding command below. Enter `Shiba Inu` at the prompt to send a dog-breed statement through the public `VibeCheck` API. To run the Jev example in the README, set `TYPESAFE_API_KEY` in your environment. [Environment template](../.env.template) · [Jev example](../README.md#using-jev)

| Provider      | Environment variable | Command                                                     |
| ------------- | -------------------- | ----------------------------------------------------------- |
| Google Gemini | `GEMINI_API_KEY`     | `node --env-file-if-exists=.env examples/gemini_client.mjs` |
| OpenAI        | `OPENAI_API_KEY`     | `node --env-file-if-exists=.env examples/openai_client.mjs` |

### Installing the local packages

With both repositories set up as above, install their archives and your provider SDK together in the consuming application. Replace `/path/to/your-app` with its directory. The command below selects OpenAI. To use Gemini or Jev, substitute `"@google/genai@^3.6.1"` or `"@typesafe-ai/sdk@^0.7.0"` respectively. Create the client with the same installed copy of the SDK that VibeTools resolves.

```sh
(cd ../vibetools-ts && npm pack)
npm pack
npm install --prefix /path/to/your-app \
  "$PWD/../vibetools-ts/vibe-engineers-vibetools-0.1.0.tgz" \
  "$PWD/vibe-engineers-vibechecks-0.1.0.tgz" \
  "openai@^7.62.0"
```

## Project Structure

- _src/index.ts_ exports the public `VibeCheck` factory.
- _src/vibecheck.ts_ validates the model and configuration, selects the shared client, and creates the callable.
- _src/config/config.ts_ defines `VibeCheckConfig` and its true-or-false instruction.
- _src/utils/logger.ts_ configures the named `VibeChecks` console logger.
- _tests/_ covers the public API, configuration, and integration with the shared tooling.
- _examples/_ contains the two provider examples. [Gemini](../examples/gemini_client.mjs) · [OpenAI](../examples/openai_client.mjs)

## Key Concepts & Design

### VibeCheck facade

`VibeCheck(client, model, config?)` takes an OpenAI, Google Gemini, or TypeSafe SDK instance and a non-empty model name. The factory throws `RangeError` for a missing or blank model and `VibeLlmClientException` for an unsupported client. Await `check(statement)` when branching. It returns a promise, which is itself truthy.

OpenAI and Gemini return a text verdict. With a `TypeSafeClient`, the check asks Jev one Noul question and returns `true` when the probability exceeds `probability_threshold`. A tie returns `false`. Use the Jev-only `await check.probability(statement)` to read the model's estimate from `0` to `1`. Each call evaluates the statement, so reuse the returned probability if you also need the verdict or a different cutoff. [TypeSafe Noul questions](https://docs.typesafe.ai/primitives/noul)

If you replace `check.llm`, the next call uses that evaluator. Test `"probability" in check` to see whether the current evaluator supports Jev probabilities. A check with an explicit cutoff requires a Jev evaluator on each call.

Library authors can export an inferred check or import its type from `@vibe-engineers/vibechecks`. Use `VibeCheckFunction` for OpenAI or Gemini and `JevCheckFunction` for a check that exposes `probability`.

TypeScript follows the Python source checkout's validation of model names and configuration types. The Python `vibechecks==1.0.2` wheel also accepted a blank model name and a base `VibeConfig` instance. Use a nonblank string and pass a `VibeCheckConfig` or plain options object in TypeScript.

A non-string statement rejects the promise with `VibeInputTypeException` before the provider receives a request. OpenAI or Gemini replies such as `"False"` resolve to `false`. When all attempts fail, the check rejects with an `Error` whose `cause` is a `VibeResponseParseException` for an unreadable verdict or a `VibeLlmApiException` for a provider failure. A timeout rejects with `VibeTimeoutException` directly. Import these exception classes from `@vibe-engineers/vibetools`.

### Configuration defaults

Pass a plain options object or a `VibeCheckConfig` instance as the third argument. Omitting it or passing `null` uses the defaults shown below.

TypeScript catches a base `VibeConfig` passed directly to the factory. JavaScript callers receive a `TypeError` for the same input. To share settings across packages, pass a plain object such as `{ timeout: 5_000 }`. Spreading a base instance into a plain object also copies its `system_instruction`, including an explicit `null`.

| Option               | Default                                                                   | What it controls                                                                                   |
| -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `system_instruction` | `Evaluate the statement below and respond with either 'True' or 'False'.` for OpenAI and Gemini | A custom instruction adds guidance to Jev's judgment. Pass `null` to clear the text instruction. |
| `timeout`            | `10_000`                                                                  | Milliseconds for the whole evaluation, including retry delays.                                     |
| `vibe_mode`          | `"chill"`                                                                 | `CHILL` allows one attempt, `EAGER` two, and `AGGRESSIVE` three, with one second between attempts. |
| `probability_threshold` | `0.5` for Jev | A finite number from `0` through `1`. A check passes when the estimate exceeds this value. |

Omitting `probability_threshold` or passing `null` or `undefined` uses the Jev default. For example, `{ probability_threshold: 0.8 }` makes a score of exactly `0.8` return `false`. A threshold of `1` makes every check return `false`. OpenAI and Gemini reject a numeric threshold because they supply a verdict directly.

Mode strings are case-insensitive. An unknown mode string raises `RangeError`. Omit `vibe_mode` to use the default in both Python and TypeScript. An explicit `null` for this option raises `TypeError` in Node.

Retry modes count attempts to obtain a verdict. VibeTools disables SDK retries on each Jev request and signals cancellation when the evaluation times out. OpenAI and Gemini apply their SDK retry settings and can finish work after the caller's deadline.

For example, given an initialized `client` and its `model`, allow a second attempt within a five-second deadline.

```ts
import { VibeCheck } from "@vibe-engineers/vibechecks"
import { VibeCheckConfig } from "@vibe-engineers/vibechecks/config/config"

const config = new VibeCheckConfig({ timeout: 5_000, vibe_mode: "EAGER" })
const check = VibeCheck(client, model, config)
const isHerdingBreed = await check("A border collie is a herding dog.")
```

### Logging

Set `VIBE_LOG_LEVEL` before starting Node. The shared logger defaults to `ERROR`. OpenAI and Gemini log provider selection at `INFO` and prompts and replies at `DEBUG`. Jev logs evaluation failures at `INFO`. For Jev request and response details, set the SDK's `TYPESAFE_LOG_LEVEL=debug`.

### Testing boundaries

The Node tests and Python comparisons use in-memory provider replies. Use the interactive examples to check a verdict from a live model. [Live examples](#live-examples)

## Code Documentation

Use TypeScript annotations for public signatures and short JSDoc comments for behavior a type cannot convey, such as what the timeout covers. Keep usage snippets and both provider examples in sync with the callable.

## Testing

Run `npm run lint` and `npm test`. The test command builds VibeChecks, type-checks its public API, and runs its Node tests. The VibeTools repository contains the lower-level provider transport tests. Use `npm pack --dry-run` to inspect the archive. [VibeTools tests](https://github.com/vibe-engineers/vibetools-ts/tree/main/tests)

To compare against Python, activate a Python environment and run the commands below. When using `VIBE_PYTHON` instead of activating the environment, install the requirements with that interpreter. The combined checkout uses the sibling Python sources when present.

```sh
python -m pip install -r tests/parity/requirements.txt
npm run test:parity
```

## Pull Requests

Start a branch in your fork and keep each change focused. Include the affected API, the behavior before and after the change, and the checks you ran. For user-visible changes, update the examples or README in the same pull request. [Contribution guide](../CONTRIBUTING.md)

## Final Notes

Discuss larger changes with the maintainers before implementation. Documentation corrections can go directly into a pull request. [Community Discord](https://discord.gg/dBW35GBCPZ)
