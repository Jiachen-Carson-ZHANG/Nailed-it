from dotenv import load_dotenv

load_dotenv()  # must run before importing router, which initialises the OpenAI client

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from src.breakdown.router import router as breakdown_router
from src.trending.router import router as trending_router
from src.tryon.router import router

app = FastAPI(title="Nailed It API", version="0.1.0")
app.include_router(router, prefix="/api/v1")
app.include_router(breakdown_router, prefix="/api/v1")
app.include_router(trending_router, prefix="/api/v1")
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def index():
    return FileResponse("static/index.html")