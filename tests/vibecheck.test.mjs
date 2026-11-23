import assert from "node:assert/strict"
import test from "node:test"
import * as vibechecks from "@vibe-engineers/vibechecks"
import { VibeCheckConfig } from "@vibe-engineers/vibechecks/config/config"
import { console_logger } from "@vibe-engineers/vibechecks/utils/logger"
import { VibeCheck as VibeCheckModule } from "@vibe-engineers/vibechecks/vibecheck"
import { VibeInputTypeException, VibeLlmClientException } from "@vibe-engineers/vibetools"
import { ConsoleLogger, VibeConfig, VibeLlmClient } from "@vibe-engineers/vibetools/_internal"
import { VibeMode } from "@vibe-engineers/vibetools/_internal/vibe_mode"
import { GoogleGenAI } from "@google/genai"
import OpenAI from "openai"

const { VibeCheck } = vibechecks
const instruction = "Evaluate the statement below and respond with either 'True' or 'False'."

test("the package exports the named VibeCheck factory", () => {
  assert.deepEqual(Object.keys(vibechecks), ["VibeCheck"])
  assert.equal(typeof VibeCheck, "function")
  assert.equal(VibeCheck, VibeCheckModule)
  assert.equal(VibeCheck.name, "VibeCheck")
})

test("VibeCheck is a call-only factory", () => {
  const client = new OpenAI({ apiKey: "test" })
  assert.throws(() => new VibeCheck(client, "model"), TypeError)
})

test("the returned check is callable without a constructor", () => {
  const client = new OpenAI({ apiKey: "test" })
  client.responses.create = async () => ({ output_text: "False" })
  const check = VibeCheck(client, "model")
  assert.throws(() => new check("Poodles are cats."), TypeError)
})

test("OpenAI receives the default instruction, original statement and selected model", async () => {
  const client = new OpenAI({ apiKey: "test" })
  const requests = []
  client.responses.create = async (request) => {
    requests.push(request)
    return { output_text: " False\n" }
  }

  const check = VibeCheck(client, "  my-model  ")
  const answer = check("Poodles are cats.")
  assert.ok(answer instanceof Promise)
  assert.equal(await answer, false)
  assert.deepEqual(requests, [
    {
      model: "  my-model  ",
      instructions: instruction,
      input: "Poodles are cats.",
    },
  ])
})

test("Gemini receives the custom instruction and returns a boolean", async () => {
  const client = new GoogleGenAI({ apiKey: "test" })
  let request
  client.models.generateContent = async (params) => {
    request = params
    return { text: "YES" }
  }

  const options = {
    system_instruction: "Decide whether this is true.",
    timeout: 12345,
    vibe_mode: "CHILL",
  }
  const check = VibeCheck(client, "my-model", options)
  assert.equal(await check("Poodles are dogs."), true)
  assert.equal(request.model, "my-model")
  assert.equal(request.contents, "Poodles are dogs.")
  assert.equal(request.config.systemInstruction, "Decide whether this is true.")
  assert.ok(check.llm.config instanceof VibeCheckConfig)
  assert.equal(check.llm.config.timeout, 12345)
  assert.equal(check.llm.config.vibe_mode, VibeMode.CHILL)
})

test("each check starts with its own default VibeCheckConfig and the package logger", () => {
  const client = new OpenAI({ apiKey: "test" })
  const check = VibeCheck(client, "model")
  const withNull = VibeCheck(client, "model", null)
  assert.ok(check.llm instanceof VibeLlmClient)
  assert.ok(check.llm.config instanceof VibeCheckConfig)
  assert.ok(check.llm.config instanceof VibeConfig)
  assert.deepEqual(check.llm.config, withNull.llm.config)
  assert.notEqual(check.llm.config, withNull.llm.config)
  assert.equal(check.llm.config.system_instruction, instruction)
  assert.equal(check.llm.logger, console_logger)
  assert.ok(console_logger instanceof ConsoleLogger)
  assert.equal(console_logger.name, "VibeChecks")
})

test("an existing VibeCheckConfig is shared with the evaluator, including a subclass", () => {
  class CustomConfig extends VibeCheckConfig {}
  const client = new OpenAI({ apiKey: "test" })
  for (const Config of [VibeCheckConfig, CustomConfig]) {
    const config = new Config({ system_instruction: null, timeout: 321 })
    const check = VibeCheck(client, "model", config)
    assert.equal(check.llm.config, config)
    assert.equal(check.llm.config.system_instruction, null)
  }
})

test("generative clients accept existing spreads and reject configured Jev thresholds", () => {
  for (const client of [
    new OpenAI({ apiKey: "offline" }),
    new GoogleGenAI({ apiKey: "offline" }),
  ]) {
    const settings = { ...new VibeCheckConfig({ timeout: 123 }) }
    assert.equal(new VibeConfig(settings).timeout, 123)
    assert.equal(VibeCheck(client, "model", settings).llm.config.timeout, 123)
    const withCutoff = new VibeCheckConfig({ probability_threshold: 0.5 })
    for (const config of [{ probability_threshold: 0 }, withCutoff, { ...withCutoff }]) {
      assert.throws(() => VibeCheck(client, "model", config), /probability_threshold.*Jev/)
    }
    for (const threshold of [undefined, null]) {
      assert.equal(
        VibeCheck(client, "model", { probability_threshold: threshold }).probability,
        undefined,
      )
    }
  }
})

test("plain options preserve explicitly empty instructions", () => {
  const options = Object.assign(Object.create(null), { system_instruction: "" })
  const check = VibeCheck(new OpenAI({ apiKey: "test" }), "model", options)
  assert.equal(check.llm.config.system_instruction, "")
})

test("a derived config can define its own fields while inherited settings stay immutable", () => {
  class DogCheckConfig extends VibeCheckConfig {
    category = "breed"
  }
  const config = new DogCheckConfig()
  assert.throws(() => {
    config.timeout = 42
  }, TypeError)
  const check = VibeCheck(new OpenAI({ apiKey: "test" }), "model", config)
  assert.equal(check.llm.config.category, "breed")
  assert.ok(Object.isFrozen(new VibeCheckConfig()))
})

test("an undefined optional instruction is read once and uses the VibeChecks default", () => {
  let reads = 0
  const check = VibeCheck(new OpenAI({ apiKey: "test" }), "model", {
    get system_instruction() {
      reads++
      return undefined
    },
  })
  assert.equal(check.llm.config.system_instruction, instruction)
  assert.equal(reads, 1)
})

test("the callable always evaluates with its current llm", async () => {
  const first = new OpenAI({ apiKey: "test" })
  first.responses.create = async () => ({ output_text: "False" })
  const second = new GoogleGenAI({ apiKey: "test" })
  second.models.generateContent = async () => ({ text: "True" })

  const check = VibeCheck(first, "first")
  assert.equal(await check("Some statement"), false)
  check.llm = VibeCheck(second, "second").llm
  assert.equal(await check("Some statement"), true)
})

test("a synchronous failure from the current evaluator rejects the check promise", async () => {
  const check = VibeCheck(new OpenAI({ apiKey: "test" }), "model")
  const failure = new Error("evaluator failed")
  check.llm.vibe_eval = () => {
    throw failure
  }
  await assert.rejects(check("Some statement"), (error) => error === failure)
})

test("missing, blank, and non-string models fail before client selection", () => {
  for (const model of [undefined, null, "", "  \t", 123, ["model"], { name: "model" }]) {
    assert.throws(() => VibeCheck(null, model), RangeError)
  }
})

test("model validation uses the same whitespace characters as Python", () => {
  for (const model of ["\u0085", "\u001c\u001d\u001e\u001f", "\u3000"]) {
    assert.throws(() => VibeCheck(null, model), RangeError)
  }
  const client = new OpenAI({ apiKey: "test" })
  assert.doesNotThrow(() => VibeCheck(client, "\ufeff"))
})

test("configs must be a VibeCheckConfig or a plain options object", () => {
  for (const config of ["bad", 123, true, ["config"], new Date(), new VibeConfig()]) {
    assert.throws(() => VibeCheck(null, "model", config), TypeError)
  }
})

test("unsupported clients fail at construction, including SDK-shaped objects", () => {
  for (const client of [
    null,
    "client",
    123,
    [],
    { responses: { create() {} } },
    { models: { generateContent() {} } },
  ]) {
    assert.throws(() => VibeCheck(client, "model"), VibeLlmClientException)
  }
})

test("only strings are sent to the provider for evaluation", async () => {
  const client = new OpenAI({ apiKey: "test" })
  let calls = 0
  client.responses.create = async () => {
    calls += 1
    return { output_text: "True" }
  }
  const check = VibeCheck(client, "model")
  for (const invalid of [undefined, null, 0, true, [], {}, () => true]) {
    await assert.rejects(async () => check(invalid), VibeInputTypeException)
  }
  assert.equal(calls, 0)
})
