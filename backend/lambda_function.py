import base64
import json
from polly_utils import synthesize_speech

from bedrock_utils import DEFAULT_MODEL_ID, invoke_model_text
from content_tools import (
    find_relevant_manual_excerpt,
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
    # --- NEW: TTS ACTION LOGIC ---
    # This handles the "Play" button from your Manual Reader page
    if body.get("action") == "tts":
        text = body.get("text")
        language = str(body.get("language", "english")).strip().lower()
        
        if not text:
            return _response(400, {"error": "text is required for tts action"})
            
        try:
            audio_data = synthesize_speech(text, language)
            # API Gateway requires binary data to be Base64 encoded in the response
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "audio/mpeg",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": base64.b64encode(audio_data).decode('utf-8'),
                "isBase64Encoded": True
            }
        except Exception as exc:
            print(f"Polly synthesis failed: {exc}")
            return _response(500, {"error": "Unable to generate audio right now."})
    # -----------------------------
    message = _coerce_message(body)
    language = str(body.get("language", "english")).strip().lower()

    if language not in set(get_available_languages()):
        return _response(
            400,
            {"error": "language must match a language key in content.json"},
        )

    if not message:
        return _response(400, {"error": "message is required"})

    try:
        excerpt_result = find_relevant_manual_excerpt(language, message)
    except Exception as exc:
        print(f"Manual lookup failed: {exc}")
        return _response(500, {"error": "Unable to load manual content right now."})

    prompt = _build_prompt(
        message,
        language,
        excerpt_result["excerpt"],
    )

    try:
        answer = invoke_model_text(prompt)
    except Exception as exc:
        print(f"Bedrock invocation failed: {exc}")
        return _response(500, {"error": "Unable to generate answer right now."})

    return _response(
        200,
        {
            "answer": answer,
            "sourceTitles": excerpt_result["source_titles"],
            "sourceLanguage": excerpt_result["language"],
            "modelId": DEFAULT_MODEL_ID,
        },
    )
