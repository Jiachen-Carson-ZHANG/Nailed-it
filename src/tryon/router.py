import asyncio

from fastapi import APIRouter, UploadFile

from src.shared.upload import read_validated
from src.tryon.pipeline import run_tryon
from src.tryon.schemas import TryOnResponse

router = APIRouter(tags=["try-on"])


@router.post("/try-on", response_model=TryOnResponse)
async def try_on(hand_image: UploadFile, nail_style_image: UploadFile) -> TryOnResponse:
    (hand_bytes, hand_ct), (style_bytes, style_ct) = await asyncio.gather(
        read_validated(hand_image, "hand_image"),
        read_validated(nail_style_image, "nail_style_image"),
    )
    image_b64 = await run_tryon(hand_bytes, hand_ct, style_bytes, style_ct)
    return TryOnResponse(image_b64=image_b64)
