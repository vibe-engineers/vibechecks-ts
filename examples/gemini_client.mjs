import { stdin, stdout } from "node:process"
import { createInterface } from "node:readline/promises"
import { GoogleGenAI } from "@google/genai"
import { VibeCheck } from "@vibe-engineers/vibechecks"

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) throw new Error("Set GEMINI_API_KEY to run this example.")
const client = new GoogleGenAI({ apiKey })
const vibecheck = VibeCheck(client, "gemini-3.1-flash-lite")

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
