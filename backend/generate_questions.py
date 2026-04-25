import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from bedrock_utils import DEFAULT_MODEL_ID, DEFAULT_REGION, invoke_model_text
from content_tools import (
    build_generation_sections,
    get_available_languages,
    get_language_label,
)


def _build_prompt(section_text, language_label):
    return f"""
You are a helpful tutor for the Alberta Basic Security Guard exam.

Given this text from the manual:
{section_text}

Generate 5 multiple choice questions in JSON format like this:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    }}
  ]
}}

Rules:
- Respond in {language_label}.
- Return JSON only. No markdown. No extra text.
- Every question must be answerable from the provided manual text.
- `correct` must be a zero-based index from 0 to 3.
- Keep explanations short and practical.
""".strip()


def _extract_json_payload(raw_text):
    text = str(raw_text).strip()

    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise ValueError("Model response did not contain a JSON object")

    return json.loads(text[start : end + 1])


def _normalize_questions(payload):
    questions = payload.get("questions")

    if not isinstance(questions, list) or not questions:
        raise ValueError("Model response missing questions array")

    normalized = []
    for item in questions:
        if not isinstance(item, dict):
            raise ValueError("Each question must be an object")

        options = item.get("options")
        if not isinstance(options, list) or len(options) != 4:
            raise ValueError("Each question must contain exactly 4 options")

        normalized.append(
            {
                "question": str(item.get("question", "")).strip(),
                "options": [str(option).strip() for option in options],
                "correct": int(item.get("correct", 0)),
                "explanation": str(item.get("explanation", "")).strip(),
            }
        )

    return normalized


def _generate_for_language(language, *, model_id, region_name, max_sections):
    sections = build_generation_sections(language)
    selected_sections = sections[:max_sections] if max_sections else sections
    language_label = get_language_label(language)
    generated = []

    for index, section in enumerate(selected_sections, start=1):
        print(
            f"Generating {language} section {index}/{len(selected_sections)}: "
            f"{section['title']}"
        )
        prompt = _build_prompt(section["text"], language_label)
        raw_response = invoke_model_text(
            prompt,
            model_id=model_id,
            region_name=region_name,
            max_tokens=1400,
            temperature=0.1,
        )
        payload = _extract_json_payload(raw_response)

        generated.append(
            {
                "sectionId": f"{language}-{index:03d}",
                "sectionTitle": section["title"],
                "questions": _normalize_questions(payload),
            }
        )

    return generated


def main():
    parser = argparse.ArgumentParser(
        description="Generate questions.json from content.json using AWS Bedrock.",
    )
    parser.add_argument(
        "--languages",
        default="english",
        help="Comma-separated languages from content.json, or 'all'. Default: english",
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parent.parent / "questions.json"),
        help="Output path for generated questions JSON.",
    )
    parser.add_argument(
        "--max-sections",
        type=int,
        default=0,
        help="Optional limit for faster test runs. Default: all sections.",
    )
    parser.add_argument(
        "--region",
        default=DEFAULT_REGION,
        help=f"AWS region for Bedrock. Default: {DEFAULT_REGION}",
    )
    parser.add_argument(
        "--model-id",
        default=DEFAULT_MODEL_ID,
        help=f"Bedrock model ID. Default: {DEFAULT_MODEL_ID}",
    )
    args = parser.parse_args()

    available_languages = set(get_available_languages())
    if args.languages.strip().lower() == "all":
        languages = sorted(available_languages)
    else:
        languages = [language.strip().lower() for language in args.languages.split(",") if language.strip()]

    invalid = [language for language in languages if language not in available_languages]
    if invalid:
        raise SystemExit(
            f"Unsupported languages: {', '.join(invalid)}. "
            f"Available: {', '.join(sorted(available_languages))}"
        )

    output = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "region": args.region,
        "modelId": args.model_id,
        "languages": {},
    }

    for language in languages:
        output["languages"][language] = _generate_for_language(
            language,
            model_id=args.model_id,
            region_name=args.region,
            max_sections=args.max_sections,
        )

    output_path = Path(args.output).resolve()
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved generated questions to {output_path}")


if __name__ == "__main__":
    main()
