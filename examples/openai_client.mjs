import { stdin, stdout } from "node:process"
import { createInterface } from "node:readline/promises"
import { VibeCheck } from "@vibe-engineers/vibechecks"
import OpenAI from "openai"

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error("Set OPENAI_API_KEY to run this example.")
const client = new OpenAI({ apiKey })
const vibecheck = VibeCheck(client, "gpt-5.6-luna")

const input = createInterface({ input: stdin, output: stdout })
try {
  const breed = await input.question("Enter a dog breed: ")
  if (await vibecheck(`${breed} is a valid dog breed`)) {
    console.log(`${breed} is a valid dog breed!`)
  } else {
    console.log(`${breed} is not a valid dog breed!`)
  }
} finally {
  input.close()
}
