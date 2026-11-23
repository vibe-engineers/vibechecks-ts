"""Return Python reference results for the Node parity test using in-memory replies."""

import json
import math
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

# In the combined checkout, compare against its working copies. A standalone
# checkout uses the reference packages installed in the selected interpreter.
repository = Path(__file__).resolve().parents[2]
python_packages = repository.parent.parent / "python"
sources = [python_packages / name / "src" for name in ("vibechecks", "vibetools")]
if all(source.is_dir() for source in sources):
    sys.path[:0] = [str(source) for source in sources]

from google import genai
from openai import OpenAI
from vibechecks import VibeCheck

TYPES = {"raw": None, "string": str, "int": int, "float": float, "list": list, "dict": dict}


def outcome(check, kind, prompt):
    try:
        value = check(prompt) if kind == "check" else check.llm.vibe_eval(prompt, TYPES[kind])
        if kind == "int":
            value = str(int(value))
        elif kind == "float" and not math.isfinite(value):
            value = {math.inf: "Infinity", -math.inf: "-Infinity"}.get(value, "NaN")
        return {"value": value}
    except Exception as error:
        cause = error.__cause__
        return {"error": type(cause or error).__name__, "wrapped": cause is not None}


def main():
    cases = json.load(sys.stdin)
    openai = Mock(spec=OpenAI)
    openai.responses = SimpleNamespace(create=lambda **args: SimpleNamespace(output_text=args["input"]))
    gemini = Mock(spec=genai.Client)
    gemini.models = SimpleNamespace(generate_content=lambda **args: SimpleNamespace(text=args["contents"]))
    result = {}
    for name, sdk in (("openai", openai), ("gemini", gemini)):
        check = VibeCheck(sdk, "offline-model")
        result[name] = [outcome(check, kind, prompt) for kind, prompt in cases]
    print(json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    main()
