import asyncio

from fastapi import APIRouter, HTTPException, UploadFile

from src.breakdown.pipeline import run_breakdown
from src.breakdown.schemas import BreakdownResponse
from src.shared.upload import read_validated

router = APIRouter(tags=["breakdown"])

_MAX_FILES = 10


@router.post("/breakdown", response_model=BreakdownResponse)
async def breakdown(files: list[UploadFile], free_mode: bool = False) -> BreakdownResponse:
    if not files:
        raise HTTPException(status_code=422, detail="At least one image is required")
    if len(files) > _MAX_FILES:
        raise HTTPException(status_code=422, detail=f"Maximum {_MAX_FILES} images allowed")

    images = await asyncio.gather(*[read_validated(f, f"File {i + 1}") for i, f in enumerate(files)])
    return await run_breakdown(images, free_mode=free_mode)
