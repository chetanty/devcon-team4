# GuardBuddy AI MVP

GuardBuddy AI is a hackathon MVP for Alberta Basic Security Training students with low English proficiency.

## 1. Frontend (React + Vite)

From the project root:

```bash
npm install
npm run dev
```

Create your environment file first:

```bash
cp .env.example .env
```

Set `VITE_API_URL` to your deployed API Gateway base URL, for example:

```env
VITE_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com
```

The frontend will POST to `POST /chat` (it appends `/chat` if your URL does not include it).

## 2. Backend (AWS Lambda + Bedrock)

- Runtime: Python 3.12
- Handler: `lambda_function.lambda_handler`
- Region: `us-east-1`
- Model: `anthropic.claude-3-haiku-20240307-v1:0`

### Files

- `backend/lambda_function.py`
- `backend/requirements.txt`

### IAM permission required

Attach a policy that allows:

- `bedrock:InvokeModel`

Minimum example statement:

```json
{
  "Effect": "Allow",
  "Action": "bedrock:InvokeModel",
  "Resource": "*"
}
```

## 3. API Gateway HTTP API

Create an HTTP API with Lambda integration:

- Route: `POST /chat`
- Integration target: your GuardBuddy Lambda function

### CORS note

Enable CORS in API Gateway and allow at minimum:

- Allowed origins: your frontend origin (or `*` for quick demo)
- Allowed methods: `POST, OPTIONS`
- Allowed headers: `Content-Type`

The Lambda response already includes CORS headers for `POST` and `OPTIONS`.

## 4. Quick deploy flow

1. Create Lambda function and upload `backend/lambda_function.py`.
2. Grant Lambda role `bedrock:InvokeModel`.
3. Create API Gateway HTTP API route `POST /chat` and integrate Lambda.
4. Enable CORS on API Gateway.
5. Copy API base URL into `.env` as `VITE_API_URL`.
6. Run frontend with `npm run dev`.
