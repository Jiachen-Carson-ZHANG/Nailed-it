from typing import Literal

from pydantic import BaseModel


class TryOnResponse(BaseModel):
    image_b64: str
    mime_type: Literal["image/png"] = "image/png"
