from pydantic import BaseModel


class NailComponent(BaseModel):
    category: str
    category_zh: str = ""
    name: str
    name_zh: str = ""
    quantity: float
    unit: str
    unit_price: float
    total_price: float
    time_minutes: float


class NailStyleBreakdown(BaseModel):
    style_name: str
    components: list[NailComponent]
    subtotal_price: float
    subtotal_time_minutes: float


class BreakdownResponse(BaseModel):
    styles: list[NailStyleBreakdown]
    total_price: float
    total_time_minutes: float
    notes: str = ""