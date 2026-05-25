import base64
import os

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

_PROMPT = (
    "Apply the nail style shown in the second image to the nails in the first image. "
    "Keep the hand, skin tone, fingers, and lighting completely realistic and unchanged. "
    "Only change the nail appearance."
)

_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_MODEL = "google/gemini-3.1-flash-image-preview"


async def run_tryon(
    hand_bytes: bytes,
    hand_content_type: str,
    style_bytes: bytes,
    style_content_type: str,
) -> str:
    hand_b64 = base64.b64encode(hand_bytes).decode()
    style_b64 = base64.b64encode(style_bytes).decode()

    payload = {
        "model": _MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{hand_content_type};base64,{hand_b64}"}},
                    {"type": "image_url", "image_url": {"url": f"data:{style_content_type};base64,{style_b64}"}},
                    {"type": "text", "text": _PROMPT},
                ],
            }
        ],
        "modalities": ["image", "text"],
    }

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            _OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {os.environ['OPENROUTER_API_KEY']}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"OpenRouter error: {response.text}")

    data = response.json()
    try:
        images = data["choices"][0]["message"]["images"]
        data_url: str = images[0]["image_url"]["url"]
        # strip "data:<mime>;base64," prefix
        b64_result = data_url.split(",", 1)[1]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Image generation produced no output")

    return b64_result
