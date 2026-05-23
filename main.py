from dotenv import load_dotenv

load_dotenv()  # must run before importing router, which initialises the OpenAI client

from fastapi import FastAPI
from src.tryon.router import router

app = FastAPI(title="Nailed It API", version="0.1.0")
app.include_router(router, prefix="/api/v1")
