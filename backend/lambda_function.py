import base64
import json
from pathlib import Path

import boto3

BEDROCK = boto3.client("bedrock-runtime", region_name="us-east-1")
MODEL_ID = "anthropic.claude-3-5-sonnet-20241022-v2:0"

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
}

def _load_training_context():
    fallback = "Alberta Basic Security Training content unavailable."

    try:
        content_path = Path(__file__).with_name("content.json")
        data = json.loads(content_path.read_text(encoding="utf-8"))
        english_content = data.get("english", "")

        if isinstance(english_content, list):
            joined = "\n".join(
                str(part).strip() for part in english_content if str(part).strip()
            ).strip()
            return joined or fallback

        if isinstance(english_content, dict):
            joined = "\n".join(
                str(value).strip()
                for value in english_content.values()
                if str(value).strip()
            ).strip()
            return joined or fallback

        text = str(english_content).strip()
        return text or fallback
    except Exception as exc:
        print(f"Failed to load content.json: {exc}")
        return fallback


TRAINING_CONTEXT = _load_training_context()

MODE_INSTRUCTIONS = {
    "explain": """
Explain the topic in simple English for a student with beginner English.
Include:
1. simple explanation
2. key exam point
3. real security guard example
4. common mistake to avoid
""".strip(),
    "quiz": """
Create 3 multiple-choice questions.
Each question must have A-D options.
Mark correct answer.
Explain why the correct answer is correct.
Explain the exam trap.
""".strip(),
    "scenario": """
Create one realistic Alberta security guard workplace scenario.
Ask what the student should do.
Then provide ideal answer.
Grade the answer using 3 criteria:
legal, professional, safe.
Include one phrase the student could say in real life.
""".strip(),
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


def _build_prompt(mode, topic):
    mode_instruction = MODE_INSTRUCTIONS[mode]

    return f"""
You are GuardBuddy AI, an exam-focused tutor for Alberta Basic Security Training students with low English proficiency.

Training context:
{TRAINING_CONTEXT}

Student topic:
{topic}

Task mode:
{mode}

Task instructions:
{mode_instruction}

Rules:
- Keep answers practical and exam-focused.
- Do not give legal advice beyond this training context.
- Do not claim the student has police powers.
- Always emphasize observe, deter, report when relevant.
- If the topic is unclear, ask for one clarification question first, then provide a best-effort answer.
""".strip()


def _extract_answer(model_output):
    content = model_output.get("content", [])

    if isinstance(content, list):
        blocks = [
            block.get("text", "").strip()
            for block in content
            if isinstance(block, dict) and block.get("type") == "text" and block.get("text")
        ]
        return "\n\n".join(blocks).strip()

    if "output_text" in model_output:
        return str(model_output["output_text"]).strip()

    return ""


def _invoke_bedrock(prompt):
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 900,
        "temperature": 0.2,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}],
            }
        ],
    }

    response = BEDROCK.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(payload),
    )

    model_output = json.loads(response["body"].read())
    answer = _extract_answer(model_output)

    if not answer:
        raise RuntimeError("Model returned an empty response")

    return answer


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

    mode = str(body.get("mode", "")).strip().lower()
    topic = str(body.get("topic", "")).strip()

    if mode not in MODE_INSTRUCTIONS:
        return _response(400, {"error": "mode must be one of: explain, quiz, scenario"})

    if not topic:
        return _response(400, {"error": "topic is required"})

    prompt = _build_prompt(mode, topic)

    try:
        answer = _invoke_bedrock(prompt)
    except Exception as exc:
        print(f"Bedrock invocation failed: {exc}")
        return _response(500, {"error": "Unable to generate answer right now."})

    return _response(200, {"answer": answer})
