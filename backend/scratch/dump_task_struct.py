"""Dump task structure"""
import asyncio, os, sys
sys.path.insert(0, "/home/tripzydevops/hotel")
os.chdir("/home/tripzydevops/hotel")

from dotenv import load_dotenv
load_dotenv(".env.local")

import httpx
import json

LOGIN = "successofmentors@gmail.com"
PASSWORD = "d276748f9354ec68"
API_URL = "https://api.dataforseo.com/v3"

async def main():
    auth = (LOGIN, PASSWORD)
    async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
        tid = "04112315-1419-0290-0000-407a1ca3f7f7"
        resp = await client.get(f"{API_URL}/business_data/google/hotel_searches/task_get/{tid}")
        data = resp.json()
        task = data["tasks"][0]
        
        print("Task keys:", list(task.keys()))
        if "data" in task:
            print("Data keys:", list(task["data"].keys()))
            print("Data tag:", task["data"].get("tag"))

asyncio.run(main())
