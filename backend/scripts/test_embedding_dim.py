
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

# EXPLANATION: Use official 2026 SDK
api_key = os.getenv("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key)

async def test():
    print("Testing 2026 Gemini Embedding dimensionality...")
    res = client.models.embed_content(
        model="gemini-embedding-001",
        contents="Strategic hotel analysis test",
        config={"output_dimensionality": 768}
    )
    try:
        dim = len(res.embeddings[0].values)
        print(f"Success: 2026 embedding has {dim} dimensions.")
    except Exception as ex:
        print(f"Failed to parse embedding: {ex}")
