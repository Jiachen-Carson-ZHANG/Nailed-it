import base64
import json
import re

from fastapi import HTTPException

from src.breakdown.schemas import BreakdownResponse
from src.shared.openrouter import MODEL, post_chat

_JSON_SCHEMA = """{
  "styles": [
    {
      "style_name": "Nail Style 1",
      "components": [
        {
          "category": "<category in English>",
          "category_zh": "<category in Chinese, e.g. 长度>",
          "name": "<component name in English>",
          "name_zh": "<component name in Chinese, e.g. 磨砂, 本甲，法式>",
          "quantity": <number>,
          "unit": "<layer|finger|piece|set|...>",
          "unit_price": <dummy USD price per unit>,
          "total_price": <quantity * unit_price>,
          "time_minutes": <dummy minutes to apply>
        }
      ],
      "subtotal_price": <sum of this style's total_price>,
      "subtotal_time_minutes": <sum of this style's time_minutes>
    }
  ],
  "total_price": <sum of all styles subtotal_price>,
  "total_time_minutes": <sum of all styles subtotal_time_minutes>,
  "notes": "<any observations about the styles>"
}"""

_PROMPT_FREE = f"""You are a nail technician assistant. You are given one or more nail style images. Analyze each image separately and freely identify every component, material, technique, and decorative element you can observe — do not limit yourself to any predefined list.

Return one entry in the "styles" array for each image, in the same order as the images provided.

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{_JSON_SCHEMA}
Use realistic dummy prices and times."""

_PROMPT = f"""You are a nail technician assistant. You are given one or more nail style images. Analyze each image separately and identify all components present.

Return one entry in the "styles" array for each image, in the same order as the images provided.

Use components from these known categories. If you identify components that are not in the categories, please feel free to add too:

LENGTH: Natural Nail (本甲), Shallow Tip Extension (浅贴延长), Half Tip Extension (半贴延长), Full Tip Extension (全贴延长)

SHAPE: Short Round (短圆形), Oval (椭圆形), Almond (杏仁形), Squoval (方圆形), Square (方形), Ballerina/Coffin (梯形), Duck (鸭嘴形)

COLOR: Solid Color High Saturation (纯色), Sheer Color Low Saturation (透色), Matte (磨砂), Glossy (亮面), Glitter (亮片色), Cat Eye (猫眼色), Aurora (极光色), Mirror (镜面色)

STYLE: Full Solid Color (纯色满色), French (法式), Gradient/Blush (渐变/腮红), Ombre (晕染), Checkerboard (棋盘格), Polka Dots (波点), Small Rhinestones (小钻), Y2K Decor (Y2K装饰), Chains (链条), Shells (贝壳), 3D Accessories (3D饰品), Stickers (贴纸)

Return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{_JSON_SCHEMA}
Use realistic dummy prices and times. Every nail set must have at least a length, shape, and color component."""


async def run_breakdown(images: list[tuple[bytes, str]], free_mode: bool = False) -> BreakdownResponse:
    prompt = _PROMPT_FREE if free_mode else _PROMPT
    content: list[dict] = [
        {"type": "image_url", "image_url": {"url": f"data:{ct};base64,{base64.b64encode(b).decode()}"}}
        for b, ct in images
    ]
    content.append({"type": "text", "text": prompt})

    data = await post_chat({"model": MODEL, "messages": [{"role": "user", "content": content}]})
    try:
        raw = data["choices"][0]["message"]["content"]
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
        return BreakdownResponse.model_validate(json.loads(raw))
    except (KeyError, IndexError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Failed to parse breakdown response: {exc}")
