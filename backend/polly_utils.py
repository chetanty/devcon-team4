import boto3
import os

# Set up the Polly client
def get_polly_client():
    return boto3.client("polly", region_name=os.getenv("AWS_REGION", "us-east-1"))

# Voice mapping based on your requirements
VOICE_MAP = {
    "english": "Joanna",
    "french": "Celine",
    "german": "Marlene",
    "spanish": "Penelope",
    "tagalog": "Joanna",  # Fallback as requested
    "punjabi": "Joanna"   # Fallback as requested
}

def synthesize_speech(text, language):
    client = get_polly_client()
    voice_id = VOICE_MAP.get(language.lower(), "Joanna")
    
    response = client.synthesize_speech(
        Text=text,
        OutputFormat="mp3",
        VoiceId=voice_id
    )
    return response['AudioStream'].read()