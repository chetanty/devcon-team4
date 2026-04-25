import json
import os
from functools import lru_cache

import boto3

DEFAULT_REGION = os.getenv("AWS_REGION", "us-east-1")
DEFAULT_MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID",
    "anthropic.claude-3-haiku-20240307-v1:0",
)


@lru_cache(maxsize=4)
def _get_bedrock_client(region_name):
    return boto3.client("bedrock-runtime", region_name=region_name)


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


def invoke_model_text(
    prompt,
    *,
    model_id=DEFAULT_MODEL_ID,
    region_name=DEFAULT_REGION,
    max_tokens=900,
    temperature=0.2,
):
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": prompt}],
            }
        ],
    }

    response = _get_bedrock_client(region_name).invoke_model(
        modelId=model_id,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(payload),
    )

    model_output = json.loads(response["body"].read())
    answer = _extract_answer(model_output)

    if not answer:
        raise RuntimeError("Model returned an empty response")

    return answer
