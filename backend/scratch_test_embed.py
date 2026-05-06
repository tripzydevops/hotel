import asyncio
import os
import sys

# Ensure backend can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.utils.ai_client import get_genai_client

async def main():
    client = get_genai_client()
    if not client:
        print("No GenAI client")
        return
    
    texts = ["How much is the room?", "What are the amenities?", "Is breakfast included?"]
    print("Sending texts:", texts)
    
    # Test text-embedding-004
    print("\n--- Testing text-embedding-004 ---")
    try:
        result = client.models.embed_content(
            model="text-embedding-004",
            contents=texts,
            config={
                "task_type": "RETRIEVAL_DOCUMENT",
                "output_dimensionality": 768,
            }
        )
        print("text-embedding-004 result.embeddings length:", len(result.embeddings))
    except Exception as e:
        print("text-embedding-004 failed:", e)

    # Test gemini-embedding-2 again
    print("\n--- Testing gemini-embedding-2 ---")
    try:
        result = client.models.embed_content(
            model="models/gemini-embedding-2",
            contents=texts,
            config={
                "task_type": "RETRIEVAL_DOCUMENT",
                "output_dimensionality": 768,
            }
        )
        print("gemini-embedding-2 result.embeddings length:", len(result.embeddings))
    except Exception as e:
        print("gemini-embedding-2 failed:", e)

    # Test individual calls in asyncio.gather or loop
    print("\n--- Testing individual calls in a loop ---")
    try:
        # Since client is synchronous or async? Let's check if client.models.embed_content is async or blocking.
        # Wait, if client is genai.Client(), its methods are synchronous by default unless we use client.aio?
        # Let's check if client.aio exists
        print("Has client.aio:", hasattr(client, "aio"))
        if hasattr(client, "aio"):
            print("Using client.aio.models.embed_content")
            tasks = [
                client.aio.models.embed_content(
                    model="models/gemini-embedding-2",
                    contents=text,
                    config={
                        "task_type": "RETRIEVAL_DOCUMENT",
                        "output_dimensionality": 768,
                    }
                )
                for text in texts
            ]
            responses = await asyncio.gather(*tasks)
            print("Aio gathered embeddings count:", len(responses))
            print("First gathered embedding length:", len(responses[0].embeddings[0].values))
    except Exception as e:
        print("Gather failed:", e)


if __name__ == "__main__":
    asyncio.run(main())
