import assert from "node:assert/strict"
import test from "node:test"
import { TypeSafeClient } from "@typesafe-ai/sdk"
import { VibeCheck } from "@vibe-engineers/vibechecks"
import OpenAI from "openai"

test("a local Node check follows replacements of its public evaluator", async () => {
  const engine = {
    getGPUVendor: async () => "offline",
    chat: {
      completions: { create: async () => ({ choices: [{ message: { content: "False" } }] }) },
    },
  }
  const check = VibeCheck(engine, "model")
  const local = check.llm
  const jev = VibeCheck(new TypeSafeClient({ apiKey: "offline" }), "model").llm
  jev.probability = async () => 0.8
  check.llm = jev
  assert.equal(await check("claim"), true)
  assert.equal(await check.probability("claim"), 0.8)
  check.llm = local
  assert.equal("probability" in check, false)
  assert.equal(await check("claim"), false)
})

test("an OpenAI SDK client with GPU metadata still uses the Responses API", async () => {
  const client = new OpenAI({ apiKey: "offline" })
  client.getGPUVendor = async () => "offline"
  client.responses.create = async () => ({ output_text: "True" })
  client.chat.completions.create = () => assert.fail("an OpenAI client was routed to WebLLM")
  assert.equal(await VibeCheck(client, "model")("claim"), true)
})

test("a check follows its current evaluator when switching between OpenAI and Jev", async () => {
  const client = new OpenAI({ apiKey: "offline" })
  client.responses.create = async () => ({ output_text: "False" })
  const textCheck = VibeCheck(client, "model")
  const jevCheck = VibeCheck(new TypeSafeClient({ apiKey: "offline" }), "model")
  jevCheck.llm.probability = async () => 0.8
  const textEvaluator = textCheck.llm
  const jevEvaluator = jevCheck.llm

  textCheck.llm = jevEvaluator
  assert.equal(await textCheck("claim"), true)
  assert.equal(await textCheck.probability("claim"), 0.8)
  const readProbability = textCheck.probability

  jevCheck.llm = textEvaluator
  assert.equal(await jevCheck("claim"), false)
  assert.equal("probability" in jevCheck, false)
  textCheck.llm = textEvaluator
  assert.equal("probability" in textCheck, false)
  await assert.rejects(readProbability("claim"), /probability.*Jev/)

  textCheck.llm = jevEvaluator
  assert.equal(await readProbability("claim"), 0.8)
})

test("a configured Jev threshold cannot be applied by a replacement text evaluator", async () => {
  const check = VibeCheck(new TypeSafeClient({ apiKey: "offline" }), "model", {
    probability_threshold: 0.8,
  })
  const jevEvaluator = check.llm
  jevEvaluator.probability = async () => 0.8
  const client = new OpenAI({ apiKey: "offline" })
  client.responses.create = () =>
    assert.fail("the provider was called with an incompatible threshold")
  check.llm = VibeCheck(client, "model").llm
  await assert.rejects(check("claim"), /probability_threshold.*Jev/)
  assert.equal("probability" in check, false)
  check.llm = jevEvaluator
  assert.equal(await check("claim"), false)
})
