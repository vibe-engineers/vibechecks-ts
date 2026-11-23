import assert from "node:assert/strict"
import { createRequire } from "node:module"
import test from "node:test"
import { TypeSafeClient } from "@typesafe-ai/sdk"
import { VibeCheck } from "@vibe-engineers/vibechecks"
import { VibeCheckConfig } from "@vibe-engineers/vibechecks/config/config"
import { VibeInputTypeException, VibeLlmClientException } from "@vibe-engineers/vibetools"

const require = createRequire(import.meta.url)
const question = "Is the statement true?"

function fixture(Client, values, config) {
  const requests = []
  const client = new Client({
    apiKey: "offline",
    baseURL: "https://jev.invalid",
    compression: false,
    async fetch(input, init) {
      const request = new Request(input, init)
      assert.equal(request.url, "https://jev.invalid/v1/systemone")
      assert.equal(request.method, "POST")
      requests.push(await request.json())
      return Response.json({
        model: "selected-model",
        answers: { decision: { type: "noul", noul: values.shift() } },
        usage: { input_tokens: 12, output_tokens: 1 },
      })
    },
  })
  return { check: VibeCheck(client, "selected-model", config), requests }
}

for (const [moduleKind, Client] of [
  ["ESM", TypeSafeClient],
  ["CommonJS", require("@typesafe-ai/sdk").TypeSafeClient],
]) {
  test(`${moduleKind} Jev checks send one Noul question and preserve the raw probability`, async () => {
    const { check, requests } = fixture(Client, [0.5, 0.50001, 0.371])
    const statement = "  This parcel arrived.\n"
    assert.equal(await check(statement), false)
    assert.equal(await check(statement), true)
    assert.equal(await check.probability(statement), 0.371)
    assert.deepEqual(
      requests,
      Array(3).fill({
        model: "selected-model",
        state: statement,
        questions: { decision: { type: "noul", instructions: question } },
      }),
    )
  })
}

test("Jev checks append custom instructions and consult the current evaluator", async () => {
  const config = new VibeCheckConfig({ system_instruction: "Use the supplied evidence." })
  const first = fixture(TypeSafeClient, [])
  const second = fixture(TypeSafeClient, [0, 1], config)
  first.check.llm = second.check.llm
  assert.equal(await first.check.probability("claim"), 0)
  assert.equal(await first.check("claim"), true)
  assert.equal(first.requests.length, 0)
  assert.equal(second.check.llm.config, config)
  assert.equal(
    second.requests[0].questions.decision.instructions,
    `${question}\n\nUse the supplied evidence.`,
  )
})

test("Jev checks apply a strict local threshold and preserve the raw score", async () => {
  for (const [threshold, scores, verdicts] of [
    [0.75, [0.74999, 0.75, 0.75001], [false, false, true]],
    [0, [0, 0.00001], [false, true]],
    [1, [0.99999, 1], [false, false]],
    [null, [0.5, 0.50001], [false, true]],
    [undefined, [0.5, 0.50001], [false, true]],
  ]) {
    const { check, requests } = fixture(TypeSafeClient, [...scores, 0.12345], {
      probability_threshold: threshold,
    })
    for (const verdict of verdicts) assert.equal(await check("claim"), verdict)
    assert.equal(await check.probability("claim"), 0.12345)
    assert.deepEqual(
      requests,
      Array(scores.length + 1).fill({
        model: "selected-model",
        state: "claim",
        questions: { decision: { type: "noul", instructions: question } },
      }),
    )
  }
})

test("a VibeCheckConfig reads its threshold once and protects it in subclasses", async () => {
  class CustomConfig extends VibeCheckConfig {
    label = "custom"
  }
  let reads = 0
  const config = new CustomConfig({
    get probability_threshold() {
      reads++
      return 0.8
    },
  })
  const { check } = fixture(TypeSafeClient, [0.8], config)
  assert.equal(await check("claim"), false)
  assert.equal(check.llm.config, config)
  assert.equal(reads, 1)
  assert.throws(() => {
    config.probability_threshold = 0
  }, TypeError)
})

test("Jev checks validate the threshold before evaluation", () => {
  for (const threshold of [true, false, "0.5", -0.01, 1.01, NaN, Infinity, -Infinity]) {
    assert.throws(
      () => fixture(TypeSafeClient, [], { probability_threshold: threshold }),
      /probability_threshold.*(number|0.*1)/,
    )
  }
})

test("invalid statements and SDK lookalikes fail before reaching Jev", async () => {
  const { check, requests } = fixture(TypeSafeClient, [])
  for (const invoke of [check, check.probability]) {
    await assert.rejects(invoke({ statement: "invalid" }), VibeInputTypeException)
  }
  assert.equal(requests.length, 0)
  assert.throws(() => VibeCheck({ systemOne() {} }, "model"), VibeLlmClientException)
})
