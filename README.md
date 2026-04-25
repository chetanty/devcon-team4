# GuardBuddy AI

Hackathon MVP for Alberta Basic Security Training learners with low English proficiency.

## Stack

- Frontend: React + Vite
- Backend: Python AWS Lambda
- API: API Gateway HTTP API
- AI: Amazon Bedrock Claude 3 Haiku

## Frontend setup

Install and run from the project root:

```bash
npm install
npm run dev
```

Create an environment file:

```bash
cp .env.example .env
```

Set API URL:

```env
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com
```

The frontend sends a `POST` request to `/chat`.

## Backend (Lambda)

- Runtime: Python 3.12
- Handler: `lambda_function.lambda_handler`
- Source file: `backend/lambda_function.py`
- Python deps: `backend/requirements.txt`
- Model: `anthropic.claude-3-haiku-20240307-v1:0`

### Deploy Lambda

1. Create a Lambda function in `us-east-1`.
2. Upload `backend/lambda_function.py`.
3. Set handler to `lambda_function.lambda_handler`.
4. Attach IAM permission `bedrock:InvokeModel`.

## Required IAM permission

The Lambda execution role must allow:

- `bedrock:InvokeModel`

Example policy statement:

```json
{
	"Effect": "Allow",
	"Action": "bedrock:InvokeModel",
	"Resource": "*"
}
```

## API Gateway HTTP API

Create and deploy an HTTP API with:

- Route: `POST /chat`
- Integration: your Lambda function

## CORS note

Enable CORS in API Gateway and allow:

- Methods: `POST, OPTIONS`
- Headers: `Content-Type`
- Origins: your frontend URL (or `*` for demo)

Lambda responses already include matching CORS headers.
