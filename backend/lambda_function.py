import base64
import json
import random

from bedrock_utils import DEFAULT_MODEL_ID, invoke_model_text
from content_tools import (
    find_relevant_manual_excerpt,
    build_generation_sections,
    get_available_languages,
    get_language_label,
)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
}

def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            **CORS_HEADERS,
        },
        "body": json.dumps(body),
    }


def _parse_event_body(event):
    body = event.get("body")
    if body is None:
        return {}
    if isinstance(body, dict):
        return body
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    if isinstance(body, str):
        text = body.strip()
        if not text:
            return {}
        return json.loads(text)
    raise ValueError("Unsupported event body format")


def _coerce_message(body):
    message = str(body.get("message", "")).strip()
    if message:
        return message
    mode = str(body.get("mode", "")).strip().lower()
    topic = str(body.get("topic", "")).strip()
    if not topic:
        return ""
    if mode == "quiz":
        return f"Create a short quiz about {topic}."
    if mode == "scenario":
        return f"Give me a realistic Alberta security scenario about {topic}."
    return f"Explain {topic} for a beginner student."


def _build_prompt(message, language, manual_excerpt):
    language_label = get_language_label(language)
    return f"""
You are a helpful tutor for the Alberta Basic Security Guard Training exam.

Answer only from the manual excerpt provided below.
Always respond in {language_label}.
If the manual excerpt does not contain enough information, say that you cannot find the answer in the provided manual section and ask the student to narrow the topic.
Keep the answer practical, supportive, and easy to understand.
Do not mention that you are using Bedrock or a prompt.

Manual excerpt:
{manual_excerpt}

Student question:
{message}
""".strip()


def _extract_json_payload(raw_text):
    text = str(raw_text).strip()
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start:end + 1])


def _normalize_questions(payload):
    questions = payload.get("questions")
    if not isinstance(questions, list) or not questions:
        raise ValueError("Missing questions array")
    normalized = []
    for item in questions:
        options = item.get("options")
        if not isinstance(options, list) or len(options) != 4:
            continue
        normalized.append({
            "question": str(item.get("question", "")).strip(),
            "options": [str(o).strip() for o in options],
            "correct": int(item.get("correct", 0)),
            "explanation": str(item.get("explanation", "")).strip(),
        })
    return normalized


def _build_questions_prompt(section_text, language_label):
    return f"""
You are a quiz generator for the Alberta Basic Security Guard exam.

Based on this manual excerpt:
{section_text}

Generate 5 multiple choice questions as JSON only, no markdown, no extra text:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["option1", "option2", "option3", "option4"],
      "correct": 0,
      "explanation": "..."
    }}
  ]
}}

Rules:
- correct is zero-based index 0-3
- Respond in {language_label}
- Return JSON only, no extra text
- Every question must be answerable from the manual excerpt
""".strip()


def _handle_questions(language):
    language_label = get_language_label(language)
    sections = build_generation_sections(language)

    # Pick a random section so questions are different each time
    section = random.choice(sections)

    prompt = _build_questions_prompt(section["text"], language_label)
    raw = invoke_model_text(prompt, max_tokens=1400, temperature=0.9)
    payload = _extract_json_payload(raw)
    questions = _normalize_questions(payload)

    return questions


def lambda_handler(event, context):
    method = (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", "")
        .upper()
    )

    if method == "OPTIONS":
        return _response(200, {"message": "ok"})

    if method and method != "POST":
        return _response(405, {"error": "Method not allowed. Use POST."})

    try:
        body = _parse_event_body(event)
    except (ValueError, json.JSONDecodeError):
        return _response(400, {"error": "Invalid JSON request body."})

    language = str(body.get("language", "english")).strip().lower()

    if language not in set(get_available_languages()):
        return _response(400, {"error": "language must match a language key in content.json"})

    # Questions mode
    mode = str(body.get("mode", "")).strip().lower()
    if mode == "questions":
        try:
            questions = _handle_questions(language)
            return _response(200, {"questions": questions})
        except Exception as exc:
            print(f"Question generation failed: {exc}")
            return _response(500, {"error": "Unable to generate questions right now."})

    # Normal chat mode
    message = _coerce_message(body)
    if not message:
        return _response(400, {"error": "message is required"})

    try:
        excerpt_result = find_relevant_manual_excerpt(language, message)
    except Exception as exc:
        print(f"Manual lookup failed: {exc}")
        return _response(500, {"error": "Unable to load manual content right now."})

    prompt = _build_prompt(message, language, excerpt_result["excerpt"])

    try:
        answer = invoke_model_text(prompt)
    except Exception as exc:
        print(f"Bedrock invocation failed: {exc}")
        return _response(500, {"error": "Unable to generate answer right now."})

    return _response(200, {
        "answer": answer,
        "sourceTitles": excerpt_result["source_titles"],
        "sourceLanguage": excerpt_result["language"],
        "modelId": DEFAULT_MODEL_ID,
    })