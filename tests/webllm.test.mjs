import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { VibeCheck } from "@vibe-engineers/vibechecks"
import { VibeCheckConfig } from "@vibe-engineers/vibechecks/config/config"
import {
  VibeInputTypeException,
  VibeLlmApiException,
  VibeResponseParseException,
  VibeTimeoutException,
} from "@vibe-engineers/vibetools"

// The same public methods exist on the main-thread engine and the WebLLM worker proxy.
function engine(create) {
  return { getGPUVendor: async () => "offline", chat: { completions: { create } } }
}

function answer(content) {
  return { choices: [{ message: { content } }] }
}

test("the default local boolean prompt demonstrates both verdicts and keeps checks independent", async () => {
  const requests = []
  const check = VibeCheck(
    engine(async ({ messages }) => {
      requests.push(messages)
      return answer("True")
    }),
    "m",
  )
  await check("first")
  await check("second")
  await check.llm.vibe_eval("raw")
  for (const [index, statement] of ["first", "second"].entries()) {
    assert.deepEqual(
      requests[index].map(({ role }) => role),
      ["system", "user", "assistant", "user", "assistant", "user"],
    )
    assert.deepEqual(
      requests[index].filter(({ role }) => role === "assistant").map(({ content }) => content),
      ["True", "False"],
    )
    assert.equal(requests[index].at(-1).content, statement)
  }
  assert.deepEqual(
    requests[2].map(({ role }) => role),
    ["system", "user"],
  )
})

test("the root factory sends a single local completion per check and parses its visible text", async () => {
  const requests = []
  const sdk = engine(async (request) => {
    requests.push(request)
    return answer(requests.length === 1 ? "  NO " : "yes")
  })
  const check = VibeCheck(sdk, "local-model", new VibeCheckConfig({ system_instruction: "Judge." }))
  assert.equal(await check("one"), false)
  assert.equal(await check("two"), true)
  assert.deepEqual(
    requests,
    ["one", "two"].map((content) => ({
      model: "local-model",
      messages: [
        { role: "system", content: "Judge." },
        { role: "user", content },
      ],
      stream: false,
      response_format: { type: "grammar", grammar: 'root ::= "True" | "False"' },
    })),
  )
  assert.equal("probability" in check, false)
  assert.throws(() => VibeCheck(sdk, "local-model", { probability_threshold: 0 }), /Jev/)
  await assert.rejects(check(12), VibeInputTypeException)
  assert.equal(requests.length, 2)
  await check.llm.vibe_eval("raw")
  assert.equal("response_format" in requests[2], false)
})

test("WebLLM respects the configured instruction, retries, errors, and deadline", async () => {
  let attempts = 0
  const local = engine(async ({ messages }) => {
    assert.deepEqual(messages, [{ role: "user", content: "claim" }])
    return ++attempts === 1 ? { choices: [] } : answer("True")
  })
  assert.equal(
    await VibeCheck(local, "m", { system_instruction: null, vibe_mode: "eager" })("claim"),
    true,
  )
  assert.equal(attempts, 2)
  const call = (create, config) => VibeCheck(engine(create), "m", config)("claim")
  await assert.rejects(
    call(async () => answer(null)),
    (error) => error.cause instanceof VibeResponseParseException,
  )
  const failure = new Error("device lost")
  await assert.rejects(
    call(async () => {
      throw failure
    }),
    (error) => error.cause instanceof VibeLlmApiException && error.cause.cause === failure,
  )
  await assert.rejects(
    call(() => new Promise(() => {}), { timeout: 20 }),
    VibeTimeoutException,
  )
})

test("a deadline stops new attempts without interrupting other checks sharing the engine", async () => {
  const pending = Promise.withResolvers()
  let slowCalls = 0
  const sdk = engine(async ({ messages }) => {
    if (messages.at(-1).content === "fast") return answer("true")
    slowCalls++
    return pending.promise
  })
  const check = VibeCheck(sdk, "m", { timeout: 50, vibe_mode: "eager" })
  const slow = assert.rejects(check("slow"), VibeTimeoutException)
  assert.equal(await check("fast"), true)
  await slow
  pending.resolve(answer("unclear"))
  await new Promise((resolve) => setTimeout(resolve, 1050))
  assert.equal(slowCalls, 1)
})

test("the browser root runs with Node built-ins and globals unavailable", () => {
  const program = `
    import assert from "node:assert/strict"
    import { register } from "node:module"
    register("data:text/javascript," + encodeURIComponent(
      'import { isBuiltin } from "node:module"; export function resolve(specifier, context, next) { if (isBuiltin(specifier)) throw Error("Browser imported " + specifier); return next(specifier, context) }'
    ), import.meta.url)
    globalThis.process = undefined
    const { VibeCheck } = await import("@vibe-engineers/vibechecks")
    const { VibeCheckConfig } = await import("@vibe-engineers/vibechecks/config/config")
    const sdk = { getGPUVendor: async () => "offline", chat: { completions: {
      create: async ({ messages }) => {
        assert.equal(messages[0].content, new VibeCheckConfig().system_instruction)
        return { choices: [{message: {content: "False"}}] }
      }
    } } }
    assert.equal(await VibeCheck(sdk, "m")("claim"), false)
    assert.throws(() => VibeCheck({ chat: sdk.chat }, "m"), { name: "VibeLlmClientException" })
  `
  const child = spawnSync(
    process.execPath,
    ["--conditions=browser", "--input-type=module", "-e", program],
    {
      cwd: new URL(".", import.meta.url),
      encoding: "utf8",
    },
  )
  assert.equal(child.status, 0, child.stderr)
})
