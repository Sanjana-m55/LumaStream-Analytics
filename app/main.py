from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Routers
from app.routes.stream import router as stream_router
from app.routes.persist import router as persist_router

app = FastAPI(title="NEON Log Analyzer – ULTRA v4")

# Static folder
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Serve UI
@app.get("/")
def home():
    return FileResponse("app/static/index.html")

# API routers
app.include_router(stream_router, prefix="/api")
app.include_router(persist_router, prefix="/api")
