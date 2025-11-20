# app/routes/persist.py
import asyncio
import sqlite3
import json
import time
from datetime import datetime
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import io

router = APIRouter()

DB_PATH = "log_analyzer.db"


# ---------------------------------------------------
# DB INIT
# ---------------------------------------------------
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Session table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            created_at TEXT
        )
    """)

    # Logs table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            line_text TEXT,
            level TEXT,
            latency INTEGER,
            endpoint TEXT,
            method TEXT,
            ts INTEGER
        )
    """)

    conn.commit()
    conn.close()


init_db()


# ---------------------------------------------------
# Save parsed logs (from frontend neon.js)
# ---------------------------------------------------
@router.post("/save_session")
async def save_session(payload: dict):
    """
    payload = {
        "name": "...",
        "lines": [{line, level, latency, endpoint, method}, ...]
    }
    """

    name = payload.get("name", f"session_{int(time.time())}")
    lines = payload.get("lines", [])

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        "INSERT INTO sessions (name, created_at) VALUES (?, ?)",
        (name, datetime.utcnow().isoformat())
    )

    session_id = cur.lastrowid

    for row in lines:
        cur.execute("""
            INSERT INTO logs 
            (session_id, line_text, level, latency, endpoint, method, ts)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id,
            row.get("line"),
            row.get("level"),
            row.get("latency"),
            row.get("endpoint"),
            row.get("method"),
            int(time.time() * 1000)
        ))

    conn.commit()
    conn.close()

    return {"status": "saved", "session_id": session_id}


# ---------------------------------------------------
# List all sessions
# ---------------------------------------------------
@router.get("/sessions")
async def list_sessions():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("SELECT id, name, created_at FROM sessions ORDER BY id DESC")
    rows = cur.fetchall()

    conn.close()

    return [{"id": r[0], "name": r[1], "created": r[2]} for r in rows]


# ---------------------------------------------------
# Get full session detail
# ---------------------------------------------------
@router.get("/session/{sid}")
async def get_session(sid: int):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        SELECT line_text, level, latency, endpoint, method, ts
        FROM logs
        WHERE session_id=?
        ORDER BY id
    """, (sid,))

    rows = cur.fetchall()
    conn.close()

    lines = []
    for r in rows:
        lines.append({
            "line": r[0],
            "level": r[1],
            "latency": r[2],
            "endpoint": r[3],
            "method": r[4],
            "ts": r[5]
        })

    return {"session_id": sid, "lines": lines}


# ---------------------------------------------------
# Summary endpoint
# ---------------------------------------------------
@router.get("/session/{sid}/summary")
async def summarize_session(sid: int):

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("""
        SELECT level, latency, endpoint, line_text
        FROM logs WHERE session_id=?
    """, (sid,))

    rows = cur.fetchall()
    conn.close()

    total = len(rows)
    counts = {"ERROR": 0, "WARN": 0, "INFO": 0}
    endpoints = {}
    lat_data = []
    error_samples = []

    for row in rows:
        lvl = (row[0] or "INFO").upper()
        counts[lvl] = counts.get(lvl, 0) + 1

        ep = row[2] or "unknown"
        endpoints[ep] = endpoints.get(ep, 0) + 1

        if row[1] is not None:
            lat_data.append(int(row[1]))

        if lvl == "ERROR" and len(error_samples) < 5:
            error_samples.append(row[3])

    avg_latency = int(sum(lat_data) / len(lat_data)) if lat_data else None
    top_endpoints = sorted(endpoints.items(), key=lambda x: x[1], reverse=True)[:8]

    return {
        "total": total,
        "counts": counts,
        "avg_latency": avg_latency,
        "top_endpoints": top_endpoints,
        "error_samples": error_samples
    }


# ---------------------------------------------------
# PDF generation - FIXED VERSION WITH DEBUG
# ---------------------------------------------------
@router.get("/session/{sid}/report.pdf")
async def generate_pdf(sid: int):
    print(f"[DEBUG] PDF generation requested for session: {sid}")
    
    # Fetch summary
    summary = await summarize_session(sid)
    print(f"[DEBUG] Summary fetched: {summary['total']} lines")

    # Fetch sample lines
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT line_text FROM logs WHERE session_id=? LIMIT 80", (sid,))
    sample_lines = [r[0] for r in cur.fetchall()]
    conn.close()

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    w, h = letter

    c.setFont("Helvetica-Bold", 16)
    c.drawString(40, h - 50, f"Log Report — Session {sid}")
    c.setFont("Helvetica", 10)
    c.drawString(40, h - 70, f"Generated: {datetime.utcnow().isoformat()}")

    y = h - 110

    # Summary block
    c.drawString(40, y, f"Total Lines: {summary['total']}")
    y -= 18
    c.drawString(40, y, f"Errors: {summary['counts']['ERROR']} | "
                       f"Warnings: {summary['counts']['WARN']} | "
                       f"Infos: {summary['counts']['INFO']}")
    y -= 18
    c.drawString(40, y, f"Average Latency: {summary['avg_latency']} ms")
    y -= 28

    # Top Endpoints
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Top Endpoints:")
    y -= 16
    c.setFont("Helvetica", 10)

    for ep, cnt in summary["top_endpoints"]:
        c.drawString(50, y, f"{ep} — {cnt}")
        y -= 14
        if y < 60:
            c.showPage()
            y = h - 60

    # Error samples
    y -= 20
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, "Sample Error Lines:")
    y -= 16
    c.setFont("Helvetica", 10)

    for line in summary["error_samples"]:
        c.drawString(50, y, (line[:90] + "...") if len(line) > 90 else line)
        y -= 12
        if y < 60:
            c.showPage()
            y = h - 60

    c.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=session_{sid}.pdf"
        }
    )