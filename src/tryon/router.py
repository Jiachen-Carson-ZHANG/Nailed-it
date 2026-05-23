import asyncio

from fastapi import APIRouter, HTTPException, UploadFile

from src.tryon.pipeline import run_tryon
from src.tryon.schemas import TryOnResponse

router = APIRouter(tags=["try-on"])

_MAX_BYTES = 10 * 1024 * 1024
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}


async def _read_validated(file: UploadFile, field: str) -> tuple[bytes, str]:
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"{field} must be jpeg or png, got {file.content_type}",
        )
    data = await file.read()
    if len(data) > _MAX_BYTES:
        raise HTTPException(status_code=422, detail=f"{field} exceeds 10 MB limit")
    return data, file.content_type


@router.post("/try-on", response_model=TryOnResponse)
async def try_on(hand_image: UploadFile, nail_style_image: UploadFile) -> TryOnResponse:
    (hand_bytes, hand_ct), (style_bytes, style_ct) = await asyncio.gather(
        _read_validated(hand_image, "hand_image"),
        _read_validated(nail_style_image, "nail_style_image"),
    )

    image_b64 = await run_tryon(hand_bytes, hand_ct, style_bytes, style_ct)

    return TryOnResponse(image_b64=image_b64)
