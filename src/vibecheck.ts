import { VibeInputTypeException } from "@vibe-engineers/vibetools"
import {
  type DecisionClientResult,
  type JevClient,
  JevEvaluator,
  type SharedClient,
  type VibeConfig,
  type VibeConfigOptions,
  VibeLlmClient,
  isJevClient,
} from "@vibe-engineers/vibetools/_internal"
import { strip } from "@vibe-engineers/vibetools/_internal/text"
import {
  VibeCheckConfig,
  type VibeCheckConfigOptions,
  defaultCheckInstruction,
} from "./config/config.js"
import { console_logger } from "./utils/logger.js"

/** A configured boolean check and its underlying evaluator. */
export interface VibeCheckFunction<Evaluator = VibeLlmClient> {
  (statement: string): Promise<boolean>
  llm: Evaluator
}

export interface JevCheckFunction extends VibeCheckFunction<JevEvaluator> {
  probability(statement: string): Promise<number>
}

type Client = JevClient | SharedClient
type Evaluator = JevEvaluator | VibeLlmClient
type MutableCheck = VibeCheckFunction<Evaluator> & Partial<Pick<JevCheckFunction, "probability">>
type Config = VibeCheckConfig | VibeCheckConfigOptions | null
type CheckResult<C extends Client> = DecisionClientResult<C, JevCheckFunction, VibeCheckFunction>
// A specialized factory can receive all the shared fields spread from an initialized config.
type SpreadSettings = Pick<VibeConfig, keyof VibeConfig> & VibeConfigOptions
type GenerativeConfig<Options extends VibeCheckConfigOptions> =
  | VibeCheckConfig
  | (VibeConfigOptions & { probability_threshold?: null | undefined })
  | (Options &
      Record<Exclude<keyof Options, keyof VibeCheckConfigOptions>, never> &
      (Options extends { probability_threshold: number } ? never : unknown))
  | null

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
  client: SharedClient | JevClient,
  model: string,
  config?: Config,
): MutableCheck => {
  if (typeof model !== "string" || !strip(model)) {
    throw new RangeError("model must be a non-empty string.")
  }
  const checkConfig = config instanceof VibeCheckConfig ? config : new VibeCheckConfig(config ?? {})
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
  check.llm = jev
    ? new JevEvaluator(
        client,
        model,
        checkConfig,
        console_logger,
        "Is the statement true?",
        defaultCheckInstruction,
      )
    : new VibeLlmClient(client, model, checkConfig, console_logger)
  return check
}) as VibeCheckFactory
