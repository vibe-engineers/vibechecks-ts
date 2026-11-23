import type { GoogleGenAI } from "@google/genai"
import type { TypeSafeClient } from "@typesafe-ai/sdk"
import {
  type JevCheckFunction,
  VibeCheck,
  type VibeCheckFunction,
} from "@vibe-engineers/vibechecks"
import { VibeCheckConfig } from "@vibe-engineers/vibechecks/config/config"
import { VibeConfig } from "@vibe-engineers/vibetools"
import type {
  DecisionClientResult,
  JevClient,
  SharedClient,
  VibeConfigOptions,
  VibeLlmClient,
} from "@vibe-engineers/vibetools/_internal"
import type OpenAI from "openai"

declare const openai: OpenAI
declare const gemini: GoogleGenAI
declare const jev: TypeSafeClient
declare function expectType<T>(value: T): void

export const check = VibeCheck(openai, "selected-model")
const configured = VibeCheck(gemini, "another-model", new VibeCheckConfig({ timeout: 500 }))
const options = VibeCheck(gemini, "another-model", { vibe_mode: "eager" })
const emptyConfig = VibeCheck(openai, "selected-model", null)
const shared = new VibeConfig({ timeout: 500 })
VibeCheck(gemini, "another-model", { ...shared })
// @ts-expect-error Only VibeCheckConfig instances and plain settings are valid here.
VibeCheck(gemini, "another-model", shared)
check.llm = configured.llm
expectType<Promise<boolean>>(check("Poodles are dogs."))
expectType<boolean>(await options("Poodles are dogs."))
expectType<boolean>(await emptyConfig("Poodles are dogs."))
const jevCheck = VibeCheck(jev, "jev-model", { timeout: 500 })
expectType<Promise<number>>(
  VibeCheck(jev, "jev-model", { probability_threshold: 0.75 }).probability("claim"),
)
VibeCheck(jev, "jev-model", new VibeCheckConfig({ probability_threshold: 0, timeout: 500 }))
VibeCheck(openai, "model", { probability_threshold: null })
VibeCheck(gemini, "model", { probability_threshold: undefined })
declare const legacyConfig: VibeConfigOptions
VibeCheck(openai, "model", legacyConfig)
const checkSettings = { ...new VibeCheckConfig({ timeout: 500 }) }
new VibeConfig(checkSettings)
VibeCheck(gemini, "model", checkSettings)
VibeCheck(openai, "model", { ...new VibeCheckConfig() })
// @ts-expect-error Misspelled plain settings should fail at the call site.
VibeCheck(openai, "model", { timeout: 500, probability_treshold: 0.5 })
// @ts-expect-error Only Jev clients accept a numeric probability threshold.
VibeCheck(openai, "model", { probability_threshold: 0.5 })
const optionsWithCutoff = { timeout: 1000, probability_threshold: 0 }
// @ts-expect-error A Gemini client also rejects a cutoff in a typed options variable.
VibeCheck(gemini, "model", optionsWithCutoff)
// @ts-expect-error A Jev threshold must be numeric.
VibeCheck(jev, "model", { probability_threshold: "0.5" })
jevCheck.llm = VibeCheck(jev, "another-model").llm
expectType<Promise<number>>(jevCheck.probability("claim"))
expectType<Promise<boolean>>(jevCheck("claim"))
expectType<Promise<boolean>>(check.llm.vibe_eval("claim", Boolean))
declare const decoratedOpenAI: OpenAI & { getGPUVendor(): Promise<string> }
expectType<VibeLlmClient>(VibeCheck(decoratedOpenAI, "model").llm)
declare const fromExistingWrapper: ReturnType<typeof VibeCheck>
expectType<Promise<boolean>>(fromExistingWrapper.llm.vibe_eval("claim", Boolean))
declare const mixed: TypeSafeClient | OpenAI
const mixedCheck = VibeCheck(mixed, "model")
mixedCheck.llm = jevCheck.llm
if ("probability" in mixedCheck) expectType<Promise<number>>(mixedCheck.probability("claim"))
mixedCheck.llm = configured.llm
expectType<Promise<boolean>>(mixedCheck("claim"))
export function genericCheck<C extends JevClient | SharedClient>(
  client: C,
): DecisionClientResult<C, JevCheckFunction, VibeCheckFunction> {
  return VibeCheck(client, "model", legacyConfig)
}
function checkWithTimeout<C extends JevClient | SharedClient, T extends { timeout: number }>(
  client: C,
  config: T,
) {
  return VibeCheck(client, "model", config)
}
expectType<Promise<boolean>>(checkWithTimeout(openai, { timeout: 500 })("claim"))
const checkOpenAI = VibeCheck<OpenAI>
expectType<Promise<boolean>>(
  checkOpenAI(openai, "model", { timeout: 500 }).llm.vibe_eval("claim", Boolean),
)
checkOpenAI(openai, "model", checkSettings)
// @ts-expect-error Specializing the factory keeps the chosen client type.
checkOpenAI(gemini, "model")
// @ts-expect-error An OpenAI specialization rejects a numeric cutoff.
checkOpenAI(openai, "model", optionsWithCutoff)
const checkJev = VibeCheck<TypeSafeClient>
expectType<Promise<number>>(
  checkJev(jev, "model", { probability_threshold: 0.5 }).probability("claim"),
)
function forwardCheck(...args: Parameters<typeof VibeCheck>) {
  return VibeCheck(...args)
}
expectType<Promise<boolean>>(forwardCheck(openai, "model", checkSettings)("claim"))
export function genericJevCheck<C extends JevClient>(client: C) {
  return VibeCheck(client, "model", { probability_threshold: 0.75 })
}
expectType<Promise<boolean>>(genericCheck(mixed)("claim"))
expectType<Promise<number>>(genericJevCheck(jev).probability("claim"))
declare const untypedClient: ReturnType<typeof JSON.parse>
expectType<Promise<boolean>>(VibeCheck(untypedClient, "model").llm.vibe_eval("claim", Boolean))
export const alternateCheckFactory = VibeCheck
export const checkFactories = { check: VibeCheck }
// @ts-expect-error Generative clients expose only the boolean check.
check.probability("claim")
// @ts-expect-error Jev probability checks require strings too.
jevCheck.probability(42)

// @ts-expect-error Call the factory without new.
new VibeCheck(openai, "selected-model")
// @ts-expect-error The returned check also has no constructor signature.
new check("Poodles are dogs.")
// @ts-expect-error A model name is required.
VibeCheck(openai)
// @ts-expect-error Only string statements can be evaluated.
check(42)
// @ts-expect-error The boolean result must be awaited.
expectType<boolean>(check("Poodles are dogs."))
