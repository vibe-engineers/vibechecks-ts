import { VibeInputTypeException } from "@vibe-engineers/vibetools"
import {
  type JevClient,
  JevEvaluator,
  type SharedClient,
  VibeLlmClient,
  isJevClient,
} from "@vibe-engineers/vibetools/_internal"
import { usesLocalEngine } from "@vibe-engineers/vibetools/_internal/vibe_llm_client"
import { type WebLlmEngine, WebLlmWrapper } from "@vibe-engineers/vibetools/llms/webllm_wrapper"
import {
  checkSettings,
  type Config,
  type GenerativeConfig,
  type SpreadSettings,
} from "./config/settings.js"
import { type VibeCheckConfigOptions, defaultCheckInstruction } from "./config/config.js"
import { console_logger } from "./utils/logger.js"

/** A configured boolean check and its underlying evaluator. */
export interface VibeCheckFunction<Evaluator = VibeLlmClient> {
  (statement: string): Promise<boolean>
  llm: Evaluator
}

export interface JevCheckFunction extends VibeCheckFunction<JevEvaluator> {
  probability(statement: string): Promise<number>
}

type HostedClient = JevClient | SharedClient
type Client = HostedClient | WebLlmEngine
type Evaluator = JevEvaluator | VibeLlmClient | WebLlmWrapper
type MutableCheck = VibeCheckFunction<Evaluator> & Partial<Pick<JevCheckFunction, "probability">>
// Checking the full hosted union preserves DecisionClientResult for generic callers.
type CheckResult<C extends Client> = unknown extends C
  ? VibeCheckFunction
  : C extends JevClient
    ? JevCheckFunction
    : C extends HostedClient
      ? VibeCheckFunction
      : VibeCheckFunction<WebLlmWrapper>

export interface VibeCheckFactory {
  <C extends Client>(client: C & JevClient, model: string, config?: Config): CheckResult<C>
  <C extends Client, Options extends VibeCheckConfigOptions = SpreadSettings>(
    client: C,
    model: string,
    config?: GenerativeConfig<Options>,
  ): CheckResult<C>
  // Preserve ReturnType<typeof VibeCheck> for existing generative callers.
  <C extends Client, Options extends VibeCheckConfigOptions>(
    client: C & SharedClient,
    model: string,
    config?: GenerativeConfig<Options>,
  ): VibeCheckFunction
}

/** Create an asynchronous boolean check. Jev checks also expose the Noul probability. */
export const VibeCheck = ((
  client: SharedClient | JevClient | WebLlmEngine,
  model: string,
  config?: Config,
): MutableCheck => {
  const checkConfig = checkSettings(model, config)
  const threshold = checkConfig.probability_threshold ?? null
  const jev = isJevClient(client)
  if (!jev && threshold !== null)
    throw new TypeError("probability_threshold requires a Jev TypeSafeClient.")

  let evaluator: Evaluator
  async function probability(statement: string): Promise<number> {
    if (typeof statement !== "string") throw new VibeInputTypeException("Argument must be a string")
    if (!(evaluator instanceof JevEvaluator))
      throw new TypeError("probability requires a Jev evaluator.")
    return evaluator.probability(statement)
  }
  const check = (async (statement: string): Promise<boolean> => {
    if (evaluator instanceof JevEvaluator)
      return (await (check.probability ?? probability)(statement)) > (threshold ?? 0.5)
    if (threshold !== null) throw new TypeError("probability_threshold requires a Jev evaluator.")
    return evaluator.vibe_eval(statement, Boolean)
  }) as MutableCheck

  // Keep feature detection in sync when callers replace the public evaluator.
  Object.defineProperty(check, "llm", {
    enumerable: true,
    configurable: true,
    get: () => evaluator,
    set(next: Evaluator) {
      evaluator = next
      if (next instanceof JevEvaluator) check.probability ??= probability
      else delete check.probability
    },
  })
  if (jev) {
    check.llm = new JevEvaluator(
      client,
      model,
      checkConfig,
      console_logger,
      "Is the statement true?",
      defaultCheckInstruction,
    )
  } else if (usesLocalEngine(client)) {
    check.llm = new WebLlmWrapper(
      client,
      model,
      checkConfig,
      console_logger,
      defaultCheckInstruction,
    )
  } else {
    check.llm = new VibeLlmClient(client, model, checkConfig, console_logger)
  }
  return check
}) as VibeCheckFactory
