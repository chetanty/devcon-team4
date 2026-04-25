# GuardBuddy AI

GuardBuddy AI is a hackathon MVP for Alberta Basic Security Training learners.

## What is now in this repo

- A React frontend with a floating multilingual chatbot widget
- An AWS Lambda backend that calls Amazon Bedrock
- Manual-aware prompting using `content.json`
- A Bedrock script that can generate `questions.json` from the manual

## Architecture

Use this flow:

```text
React frontend -> API Gateway -> Lambda -> Amazon Bedrock
```

Do not call Bedrock directly from the browser. That would expose AWS credentials.

## Frontend setup

From the project root:

```bash
npm install
cp .env.example .env
```

Set your API Gateway base URL in `.env`:

```env
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
```

Then run:

```bash
npm run dev
```

The frontend sends `POST /chat`.

## Backend setup

Backend source lives in [backend](/Users/aahilyusuf/Documents/Codex/2026-04-25/i-want-to-work-in-this/devcon-team4/backend).

Main files:

- [backend/lambda_function.py](/Users/aahilyusuf/Documents/Codex/2026-04-25/i-want-to-work-in-this/devcon-team4/backend/lambda_function.py)
- [backend/content_tools.py](/Users/aahilyusuf/Documents/Codex/2026-04-25/i-want-to-work-in-this/devcon-team4/backend/content_tools.py)
- [backend/bedrock_utils.py](/Users/aahilyusuf/Documents/Codex/2026-04-25/i-want-to-work-in-this/devcon-team4/backend/bedrock_utils.py)
- [backend/generate_questions.py](/Users/aahilyusuf/Documents/Codex/2026-04-25/i-want-to-work-in-this/devcon-team4/backend/generate_questions.py)

You also need `content.json` packaged with the Lambda deployment.

## Generate `questions.json`

Once your AWS credentials can access Bedrock, run:

```bash
cd backend
pip install -r requirements.txt
python generate_questions.py --languages english
```

That writes `questions.json` to the project root by default.

Useful options:

```bash
python generate_questions.py --languages english,spanish --max-sections 2
python generate_questions.py --languages all
```

## AWS services you need

- `Amazon Bedrock`: runs the model
- `AWS Lambda`: holds your backend code and Bedrock call
- `API Gateway`: gives the frontend a public `/chat` endpoint
- `IAM`: gives Lambda permission to call Bedrock

## Deploy notes

Full deployment notes are in [backend/README.md](/Users/aahilyusuf/Documents/Codex/2026-04-25/i-want-to-work-in-this/devcon-team4/backend/README.md).
