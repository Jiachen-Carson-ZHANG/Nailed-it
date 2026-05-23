import os

import openai
from fastapi import HTTPException

_PROMPT = (
    "Apply the nail style shown in the second image to the nails in the first image. "
    "Keep the hand, skin tone, fingers, and lighting completely realistic and unchanged. "
    "Only change the nail appearance."
)

_client = openai.AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])


async def run_tryon(
    hand_bytes: bytes,
    hand_content_type: str,
    style_bytes: bytes,
    style_content_type: str,
) -> str:
    response = await _client.images.edit(
        model="gpt-image-2",
        image=[
            ("hand", hand_bytes, hand_content_type),
            ("style", style_bytes, style_content_type),
        ],
        prompt=_PROMPT,
        size="1024x1024",
        response_format="b64_json",
    )

    result = response.data[0].b64_json if response.data else None
    if not result:
        raise HTTPException(status_code=502, detail="Image generation produced no output")

    return result
