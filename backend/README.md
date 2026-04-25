# GuardBuddy Backend

This backend is the safe bridge between the frontend and Amazon Bedrock.

## AWS pieces and what they do

- `Amazon Bedrock`: the AI model service
- `AWS Lambda`: your Python backend function
- `API Gateway`: exposes a public HTTP endpoint for the frontend
- `IAM role`: gives Lambda permission to call Bedrock

## Request flow

```text
Browser -> API Gateway -> Lambda -> Bedrock
```

Why this matters:

- The browser can safely call API Gateway
- Lambda can safely hold AWS permissions
- Bedrock is never called with exposed frontend credentials

## Lambda runtime

- Python `3.12`
- Handler: `lambda_function.lambda_handler`
- Region: `us-east-1`
- Default model: `anthropic.claude-3-haiku-20240307-v1:0`

## Files to deploy

Your Lambda package needs these files together:

- `lambda_function.py`
- `bedrock_utils.py`
- `content_tools.py`
- `content.json`

Install Python dependency:

```bash
pip install -r requirements.txt -t .
```

Then zip the backend folder contents and upload them to Lambda.

## IAM permission

Your Lambda execution role needs:

```json
{
  "Effect": "Allow",
  "Action": "bedrock:InvokeModel",
  "Resource": "*"
}
```

## API Gateway

Create an HTTP API with:

- Route: `POST /chat`
- Integration: your Lambda function

Enable CORS:

- Methods: `POST, OPTIONS`
- Headers: `Content-Type`
- Origins: your frontend URL or `*` for quick testing

## Frontend contract

The frontend sends:

```json
{
  "language": "english",
  "message": "What should a guard do after an arrest?"
}
```

The backend responds with:

```json
{
  "answer": "...",
  "sourceTitles": ["..."],
  "sourceLanguage": "english",
  "modelId": "anthropic.claude-3-haiku-20240307-v1:0"
}
```

## Bedrock playground prompt

Start by testing this manually in Bedrock playground:

```text
You are a helpful tutor for the Alberta Basic Security Guard exam.

Given this text from the manual:
[paste a paragraph]

Generate 5 multiple choice questions in JSON format like this:
{
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "..."
    }
  ]
}

Respond in English. Return JSON only. No extra text.
```

## Generate `questions.json`

From the project root:

```bash
cd backend
pip install -r requirements.txt
python generate_questions.py --languages english --max-sections 2
```

When the output looks good, remove `--max-sections 2` and run the full generation.
