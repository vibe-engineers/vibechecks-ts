import type { CreateMLCEngine, CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm"
import { VibeCheck } from "@vibe-engineers/vibechecks"
import { VibeCheckConfig } from "@vibe-engineers/vibechecks/config/config"

declare const engine: Awaited<ReturnType<typeof CreateMLCEngine>>
declare const worker: Awaited<ReturnType<typeof CreateWebWorkerMLCEngine>>

export const local = VibeCheck(engine, "loaded-model", { timeout: 30_000 })
export const inWorker = VibeCheck(worker, "loaded-model", new VibeCheckConfig())
export const verdict: Promise<boolean> = local("A poodle is a dog.")
// @ts-expect-error Only Jev exposes probabilities.
inWorker.probability("claim")
// @ts-expect-error WebLLM returns text verdicts.
VibeCheck(engine, "model", { probability_threshold: 0.5 })
