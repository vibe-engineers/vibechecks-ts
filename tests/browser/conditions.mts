import type { MLCEngineInterface } from "@mlc-ai/web-llm"
import {
  type JevCheckFunction,
  VibeCheck,
  type VibeCheckFactory,
  type VibeCheckFunction,
} from "@vibe-engineers/vibechecks"
import { VibeCheck as fromSubpath } from "@vibe-engineers/vibechecks/vibecheck"

declare module "@vibe-engineers/vibechecks" {
  interface VibeCheckFactory {
    applicationLabel?: string
  }
}
declare module "@vibe-engineers/vibechecks/vibecheck" {
  interface VibeCheckFunction {
    applicationLabel?: string
  }
}

declare const engine: MLCEngineInterface
declare const jev: JevCheckFunction
const factory: VibeCheckFactory = VibeCheck
const check: VibeCheckFunction = factory(engine, "loaded-model")
export const factoryLabel: string | undefined = fromSubpath.applicationLabel
export const checkLabel: string | undefined = VibeCheck(engine, "loaded-model").applicationLabel
export const jevLabel: string | undefined = jev.applicationLabel
export const vendor: Promise<string> = check.llm.client.getGPUVendor()
export const workerCheck = fromSubpath(engine, "loaded-model")
const cloud = { responses: { create: async () => ({ output_text: "True" }) } }
// @ts-expect-error The browser entry accepts local engines only.
VibeCheck(cloud, "model")
// @ts-expect-error The subpath selects the same browser entry.
fromSubpath(cloud, "model")
const cutoff = { timeout: 1000, probability_threshold: 0.5 }
// @ts-expect-error Local inference has no Jev probability threshold.
VibeCheck(engine, "loaded-model", cutoff)
