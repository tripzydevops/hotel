
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("Error: GOOGLE_API_KEY not set")
    exit(1)

# EXPLANATION: Official 2026 SDK
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

def list_flash_models():
    print("Listing available 2026 Gemini models...")
    for m in client.models.list():
        print(f" - {m.name}: {m.supported_actions}")

if __name__ == "__main__":
    list_flash_models()
