from pydantic import BaseModel


class NailComponent(BaseModel):
    category: str
    name: str
    quantity: float
    unit: str
    unit_price: float
    total_price: float
    time_minutes: float


class BreakdownResponse(BaseModel):
    components: list[NailComponent]
    total_price: float
    total_time_minutes: float
    notes: str = ""
