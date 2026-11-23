import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { GoogleGenAI } from "@google/genai"
import { VibeCheck } from "@vibe-engineers/vibechecks"
import OpenAI from "openai"

const words = [
  "true",
  "False",
  "T",
  "f",
  "YES",
  "no",
  "Y",
  "n",
  "1",
  "0",
  "-0",
  "0.0",
  "1e0",
  "0.1",
  "+1",
  "01",
  "2",
  "maybe",
  "",
  "null",
  "[]",
  "{}",
  "true.",
  "yes please",
  "\u0085no",
  "\u001cyes\u001f",
  "\u3000False",
  "\ufefftrue",
  '"\\u0031"',
  "🐕",
]
const replies = new Set(words.flatMap((s) => [s, ` \t${s}\n`, JSON.stringify(s)]))
const cases = [...replies, null, true, 0, [], {}].map((input) => ["check", input])
const types = {
  raw: undefined,
  string: String,
  int: BigInt,
  float: Number,
  list: Array,
  dict: Object,
}
for (const [type, inputs] of Object.entries({
  raw: ["  quoted words  ", '"text"', ""],
  string: ["\u001e model text \u001f", "false"],
  int: ["42", "-0042", "900719925474099312345", '"1_000"', "true", "false", "1.2", "0x10"],
  float: ["42", "1.25e-2", '" -2.5 "', "+Infinity", "-Infinity", "NaN", "١.٥", "true"],
  list: ['[1, {"dog": true}]', "[]", "{}", "[1,]"],
  dict: ['{"name":"Akita","ages":[1,2]}', "{}", "[]", "null"],
})) {
  for (const input of inputs) cases.push([type, input])
}

async function outcome(check, type, input) {
  try {
    const value =
      type === "check" ? await check(input) : await check.llm.vibe_eval(input, types[type])
    if (type === "int" || (type === "float" && !Number.isFinite(value)))
      return { value: String(value) }
    return { value }
  } catch (error) {
    return { error: (error.cause ?? error).name, wrapped: error.cause !== undefined }
  }
}

test("both providers agree with the Python packages on verdicts, values and errors", async (t) => {
  const python = process.env.VIBE_PYTHON ?? (process.platform === "win32" ? "python" : "python3")
  const reference = spawnSync(
    python,
    ["-B", fileURLToPath(new URL("./python_reference.py", import.meta.url))],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 60_000,
    },
  )
  assert.equal(reference.status, 0, reference.error?.message ?? reference.stderr)
  const expected = JSON.parse(reference.stdout)
  const offline = () => {
    throw new Error("The parity test must not use a network transport")
  }
  t.mock.method(globalThis, "fetch", offline)
  const openai = new OpenAI({ apiKey: "offline", fetch: offline, maxRetries: 0 })
  openai.responses.create = async ({ input }) => ({ output_text: input })
  const gemini = new GoogleGenAI({ apiKey: "offline" })
  gemini.models.generateContent = async ({ contents }) => ({ text: contents })

  for (const [name, sdk] of Object.entries({ openai, gemini })) {
    const check = VibeCheck(sdk, "offline-model")
    assert.equal(expected[name].length, cases.length)
    for (const [i, [type, input]] of cases.entries()) {
      assert.deepEqual(
        await outcome(check, type, input),
        expected[name][i],
        `${name}, ${type}, input ${JSON.stringify(input)}`,
      )
    }
  }
  t.diagnostic(`${cases.length * 2} cross-language comparisons`)
})
