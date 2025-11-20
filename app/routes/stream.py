# app/routes/stream.py
import asyncio
import json
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse

router = APIRouter()

# Keep raw lines in memory for streaming
uploaded_lines: list[str] = []


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Stores uploaded log file in memory (Ultra-Neon v4).
    """
    global uploaded_lines
    content = await file.read()
    uploaded_lines = content.decode("utf-8", errors="ignore").splitlines()
    return {
        "status": "uploaded",
        "total_lines": len(uploaded_lines)
    }


@router.get("/stream")
async def stream_logs():
    """
    SSE real-time stream of logs line-by-line.
    Frontend handles filtering / speed / anomalies.
    """

    async def event_generator():
        for line in uploaded_lines:
            yield f"data: {json.dumps({'line': line})}\n\n"
            await asyncio.sleep(0.1)   # base pace (UI handles actual replay speed)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
