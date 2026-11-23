import { VibeConfig, type VibeConfigOptions } from "@vibe-engineers/vibetools/_internal"
import { validateProbabilityThreshold } from "@vibe-engineers/vibetools/_internal/jev_evaluator"
import { isPlainObject } from "@vibe-engineers/vibetools/_internal/vibe_config"

declare const checkConfigInstance: unique symbol
export const defaultCheckInstruction =
  "Evaluate the statement below and respond with either 'True' or 'False'."

export type VibeCheckConfigOptions = VibeConfigOptions & {
  /** Jev returns true when its probability strictly exceeds this cutoff. Defaults to 0.5. */
  probability_threshold?: number | null | undefined
}

/** Evaluation settings for boolean checks. */
export class VibeCheckConfig extends VibeConfig {
  // The factory accepts an initialized config only when it is a VibeCheckConfig.
  declare private readonly [checkConfigInstance]: true
  declare readonly probability_threshold?: number | null

  constructor(options: VibeCheckConfigOptions = {}) {
    if (!isPlainObject(options)) {
      throw new TypeError("VibeCheckConfig options must be a plain object.")
    }
    const {
      system_instruction = defaultCheckInstruction,
      probability_threshold = null,
      ...settings
    } = options
    super({ ...settings, system_instruction })
    Object.defineProperty(this, "probability_threshold", {
      value:
        probability_threshold === null ? null : validateProbabilityThreshold(probability_threshold),
      // An unset cutoff keeps spread settings compatible with the shared VibeConfig.
      enumerable: probability_threshold !== null,
    })
    if (new.target === VibeCheckConfig) Object.freeze(this)
  }
}
