import { strip } from "@vibe-engineers/vibetools/_internal/text"
import type { VibeConfig, VibeConfigOptions } from "@vibe-engineers/vibetools/_internal/vibe_config"
import { VibeCheckConfig, type VibeCheckConfigOptions } from "./config.js"

export type Config = VibeCheckConfig | VibeCheckConfigOptions | null
// A specialized factory can receive all the shared fields spread from an initialized config.
export type SpreadSettings = Pick<VibeConfig, keyof VibeConfig> & VibeConfigOptions
export type GenerativeConfig<Options extends VibeCheckConfigOptions> =
  | VibeCheckConfig
  | (VibeConfigOptions & { probability_threshold?: null | undefined })
  | (Options &
      Record<Exclude<keyof Options, keyof VibeCheckConfigOptions>, never> &
      (Options extends { probability_threshold: number } ? never : unknown))
  | null

export function checkSettings(model: string, config?: Config): VibeCheckConfig {
  if (typeof model !== "string" || !strip(model)) {
    throw new RangeError("model must be a non-empty string.")
  }
  return config instanceof VibeCheckConfig ? config : new VibeCheckConfig(config ?? {})
}
