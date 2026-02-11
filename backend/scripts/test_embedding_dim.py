
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local", override=True)

api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

model = "models/gemini-embedding-001"
text = "Standard Room with City View"

print(f"Testing embedding with {model}...")

try:
    # Try requesting 768 dimensions
    result = genai.embed_content(
        model=model,
        content=text,
        task_type="retrieval_document",
        output_dimensionality=768
    )
    embedding = result['embedding']
    print(f"Success! Got embedding with {len(embedding)} dimensions.")
except Exception as e:
    print(f"Failed with output_dimensionality=768: {e}")

    try:
        # Fallback: check native dimensionality
        result = genai.embed_content(
            model=model,
            content=text,
            task_type="retrieval_document"
        )
        print(f"Native embedding has {len(result['embedding'])} dimensions.")
    except Exception as ex:
        print(f"Failed to get native embedding: {ex}")
