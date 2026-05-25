from fastapi import HTTPException, UploadFile

MAX_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}


async def read_validated(file: UploadFile, label: str) -> tuple[bytes, str]:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"{label} must be jpeg or png, got {file.content_type}",
        )
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"{label} exceeds {MAX_BYTES // (1024 * 1024)} MB limit",
        )
    return data, file.content_type
