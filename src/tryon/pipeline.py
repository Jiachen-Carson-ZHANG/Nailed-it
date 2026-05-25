import base64

from src.shared.openrouter import MODEL, post_chat

_PROMPT = (
    "Apply the nail style shown in the second image to the nails in the first image. "
    "Keep the hand, skin tone, fingers, and lighting completely realistic and unchanged. "
    "Only change the nail appearance."
)


async def run_tryon(
    hand_bytes: bytes,
    hand_content_type: str,
    style_bytes: bytes,
    style_content_type: str,
) -> str:
    from fastapi import HTTPException

    hand_b64 = base64.b64encode(hand_bytes).decode()
    style_b64 = base64.b64encode(style_bytes).decode()

    payload = {
        "model": MODEL,
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

    data = await post_chat(payload)
    try:
        images = data["choices"][0]["message"]["images"]
        data_url: str = images[0]["image_url"]["url"]
        return data_url.split(",", 1)[1]
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Image generation produced no output")
