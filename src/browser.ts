import { VibeLlmClientException } from "@vibe-engineers/vibetools"
import {
  type WebLlmEngine,
  WebLlmWrapper,
  isWebLlmEngine,
} from "@vibe-engineers/vibetools/llms/webllm_wrapper"
import {
  checkSettings,
  type Config,
  type GenerativeConfig,
  type SpreadSettings,
} from "./config/settings.js"
import { defaultCheckInstruction, type VibeCheckConfigOptions } from "./config/config.js"
import { console_logger } from "./utils/logger.js"
import type {
  VibeCheckFunction as CheckFunction,
  JevCheckFunction as JevCheck,
} from "./vibecheck.js"

export interface VibeCheckFunction<Evaluator = WebLlmWrapper> extends CheckFunction<Evaluator> {}
export interface JevCheckFunction extends JevCheck, VibeCheckFunction<JevCheck["llm"]> {}
export interface VibeCheckFactory {
  // biome-ignore lint/style/useShorthandFunctionType: Consumers can augment the public factory interface.
  <Engine extends WebLlmEngine, Options extends VibeCheckConfigOptions = SpreadSettings>(
    engine: Engine,
    model: string,
    config?: GenerativeConfig<Options>,
  ): VibeCheckFunction
}

/** Browser builds use the engine initialized by the caller. */
export const VibeCheck: VibeCheckFactory = (
  engine: WebLlmEngine,
  model: string,
  config?: Config,
): VibeCheckFunction => {
  const settings = checkSettings(model, config)
  if (!isWebLlmEngine(engine)) {
    throw new VibeLlmClientException("A browser VibeCheck requires a WebLLM engine.")
  }
  if (settings.probability_threshold != null) {
    throw new TypeError("probability_threshold requires a Jev TypeSafeClient.")
  }
  const check: VibeCheckFunction = async (statement) => check.llm.vibe_eval(statement, Boolean)
  check.llm = new WebLlmWrapper(engine, model, settings, console_logger, defaultCheckInstruction)
  return check
}
