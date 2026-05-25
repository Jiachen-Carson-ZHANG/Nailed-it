import os

import httpx
from fastapi import HTTPException

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-3.1-flash-image-preview"

_client = httpx.AsyncClient(timeout=120)


async def post_chat(payload: dict) -> dict:
    response = await _client.post(
        _OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
            "Content-Type": "application/json",
        },
        json=payload,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {response.text}")
    return response.json()
