// ===============================================================
// NEON LOG ANALYZER — ULTRA v4 (FIXED)
// Full real-time streaming + charts + gauges + terminal + anomalies
// ===============================================================

// -------- GLOBAL STATE --------
let ev = null;
let playing = false;
let paused = false;
let streamSpeed = 300;

let errorCount = 0;
let warnCount = 0;
let infoCount = 0;

let latencyTimeline = [];
let endpointCounts = {};
let methodCounts = {};
let rateWindow = [];
let lineTimestamps = [];

let pieChart = null;
let lineChart = null;
let rateChart = null;
let endpointChart = null;
let methodChart = null;

let rpsInterval = null;

// gauges
let cpu = 0;
let mem = 0;

// audio
let audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=');


// -------- DOM REFERENCES --------
const fileInput = document.getElementById("fileInput");
const searchInput = document.getElementById("searchInput");
const focusSelect = document.getElementById("focusSelect");
const anomalySens = document.getElementById("anomalySens");
const autoscrollBox = document.getElementById("autoscroll");


// ===============================================================
// STREAM CONTROLS
// ===============================================================

async function startStream() {
    const file = fileInput.files[0];
    if (!file) return alert("Upload a file first!");

    resetState();

    document.getElementById("startBtn").disabled = true;
    document.getElementById("pauseBtn").disabled = false;
    document.getElementById("stopBtn").disabled = false;

    const fd = new FormData();
    fd.append("file", file);

    await fetch("/api/upload", { method: "POST", body: fd });

    if (ev) ev.close();
    ev = new EventSource("/api/stream");
    playing = true;

    ev.onmessage = (e) => {
        const payload = JSON.parse(e.data);
        handleRawLine(payload.line);
    };

    startRPS();
}

function pauseStream() {
    if (!playing) return;
    ev.close();
    playing = false;
    paused = true;

    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("resumeBtn").disabled = false;
}

function resumeStream() {
    if (!paused) return;

    ev = new EventSource("/api/stream");
    playing = true;
    paused = false;

    document.getElementById("pauseBtn").disabled = false;
    document.getElementById("resumeBtn").disabled = true;

    ev.onmessage = e => {
        const payload = JSON.parse(e.data);
        handleRawLine(payload.line);
    };
}

function stopStream() {
    if (ev) ev.close();
    playing = false;
    paused = false;

    stopRPS();

    document.getElementById("startBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("resumeBtn").disabled = true;
    document.getElementById("stopBtn").disabled = true;
}


// ===============================================================
// PROCESS RAW LINE
// ===============================================================
function handleRawLine(line) {
    // filter
    const q = searchInput.value.trim().toLowerCase();
    if (q && !line.toLowerCase().includes(q)) return;

    const focusVal = focusSelect.value;
    if (focusVal && !line.includes(focusVal)) return;

    processLogLine(line);
}


// ===============================================================
// PARSE & DISPLAY LOG LINE
// ===============================================================
function processLogLine(rawLine) {
    const logBox = document.getElementById("logBox");

    let level = "INFO";
    if (rawLine.match(/\bERROR\b/i)) level = "ERROR";
    else if (rawLine.match(/\bWARN(ING)?\b/i)) level = "WARN";

    let latencyMatch = rawLine.match(/(\d+)ms/);
    let latency = latencyMatch ? parseInt(latencyMatch[1]) : null;

    let methodMatch = rawLine.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/i);
    let method = methodMatch ? methodMatch[1].toUpperCase() : null;

    let endpointMatch = rawLine.match(/\s(\/[A-Za-z0-9_\-\/\.]+)\b/);
    let endpoint = endpointMatch ? endpointMatch[1] : "unknown";

    // display line
    const div = document.createElement("div");
    div.classList.add("log-line");

    if (level === "ERROR") div.classList.add("log-error");
    else if (level === "WARN") div.classList.add("log-warn");
    else div.classList.add("log-info");

    div.textContent = rawLine;
    logBox.appendChild(div);

    if (autoscrollBox.checked) {
        logBox.scrollTop = logBox.scrollHeight;
    }

    // update stats
    if (level === "ERROR") errorCount++;
    else if (level === "WARN") warnCount++;
    else infoCount++;

    if (latency !== null) latencyTimeline.push(latency);
    lineTimestamps.push(Date.now());

    endpointCounts[endpoint] = (endpointCounts[endpoint] || 0) + 1;
    methodCounts[method] = (methodCounts[method] || 0) + 1;

    updateCounters();
    updateCharts();
    detectBurst(level);
    detectLatencySpike(latency);
    refreshFocusSelect();
}


// ===============================================================
// UPDATE DOM COUNTERS
// ===============================================================
function updateCounters() {
    document.getElementById("errCount").textContent = errorCount;
    document.getElementById("warnCount").textContent = warnCount;
    document.getElementById("infoCount").textContent = infoCount;
}


// ===============================================================
// CHART HANDLING
// ===============================================================
function updateCharts() {
    ensureCharts();

    // pie
    pieChart.data.datasets[0].data = [errorCount, warnCount, infoCount];
    pieChart.update();

    // latency
    lineChart.data.labels = latencyTimeline.map((_, i) => i + 1);
    lineChart.data.datasets[0].data = latencyTimeline;
    lineChart.update();

    // endpoint usage
    endpointChart.data.labels = Object.keys(endpointCounts);
    endpointChart.data.datasets[0].data = Object.values(endpointCounts);
    endpointChart.update();

    // method usage
    methodChart.data.labels = Object.keys(methodCounts);
    methodChart.data.datasets[0].data = Object.values(methodCounts);
    methodChart.update();
}

function ensureCharts() {
    if (pieChart) return;

    pieChart = new Chart(document.getElementById("pieChart"), {
        type: "pie",
        data: {
            labels: ["Errors", "Warnings", "Infos"],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ["#ff0066", "#ffd000", "#00eaff"]
            }]
        }
    });

    lineChart = new Chart(document.getElementById("lineChart"), {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Latency (ms)",
                borderColor: "#00fcef",
                data: [],
                tension: 0.3
            }]
        }
    });

    rateChart = new Chart(document.getElementById("rateChart"), {
        type: "line",
        data: { labels: [], datasets: [{ label: "Logs/sec", data: [], borderColor: "#a78bfa" }] }
    });

    endpointChart = new Chart(document.getElementById("endpointChart"), {
        type: "bar",
        data: { labels: [], datasets: [{ label: "Requests", data: [], backgroundColor: "#8b5cf6" }] },
        options: { indexAxis: "y" }
    });

    methodChart = new Chart(document.getElementById("methodChart"), {
        type: "doughnut",
        data: { labels: [], datasets: [{ data: [], backgroundColor: ["#06b6d4", "#f59e0b", "#ef4444", "#10b981"] }] }
    });
}


// ===============================================================
// RPS CALCULATION
// ===============================================================
function startRPS() {
    rpsInterval = setInterval(() => {
        const now = Date.now();
        const count = lineTimestamps.filter(t => t > now - 1000).length;

        rateWindow.push(count);
        if (rateWindow.length > 30) rateWindow.shift();

        if (rateChart) {
            rateChart.data.labels = rateWindow.map((_, i) => i + 1);
            rateChart.data.datasets[0].data = rateWindow;
            rateChart.update();
        }

        document.getElementById("rps").textContent = count;
    }, 1000);
}

function stopRPS() {
    clearInterval(rpsInterval);
}



// ===============================================================
// ANOMALY DETECTION
// ===============================================================
let lastErrors = [];

function detectBurst(level) {
    if (level !== "ERROR") return;

    const now = Date.now();
    lastErrors.push(now);
    lastErrors = lastErrors.filter(t => now - t < 5000);

    if (lastErrors.length >= 5) {
        showToast("🔥 ERROR BURST DETECTED!");
        lastErrors = [];
    }
}

function detectLatencySpike(latency) {
    if (latency == null || latencyTimeline.length < 10) return;

    const sens = parseInt(anomalySens.value);
    const arr = latencyTimeline.slice(-50);
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2) / arr.length;
    const std = Math.sqrt(variance);

    if (latency > mean + sens * std) {
        showToast(`⚠ Latency Spike: ${latency}ms`);
    }
}


// ===============================================================
// TOAST / TERMINAL STYLE OUTPUT
// ===============================================================
function showToast(msg) {
    const box = document.getElementById("terminalOutput");
    const p = document.createElement("div");
    p.textContent = `${new Date().toLocaleTimeString()} — ${msg}`;
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;

    if (document.getElementById("audioToggle").checked) audio.play();
}


// Terminal commands
function runTerminalCommand() {
    const input = document.getElementById("terminalInput");
    const cmd = input.value.trim();
    input.value = "";

    const out = document.getElementById("terminalOutput");

    out.innerHTML += `<div>&gt; ${cmd}</div>`;

    if (cmd === "help") {
        out.innerHTML += `<div>Commands: help | show errors | show warnings | stats | show endpoint /api/x</div>`;
        return;
    }

    if (cmd === "show errors") {
        out.innerHTML += `<div>Total errors: ${errorCount}</div>`;
        return;
    }

    if (cmd.startsWith("show endpoint")) {
        const ep = cmd.replace("show endpoint", "").trim();
        out.innerHTML += `<div>${ep}: ${endpointCounts[ep] || 0}</div>`;
        return;
    }

    if (cmd === "stats") {
        out.innerHTML += `<div>Errors ${errorCount} | Warnings ${warnCount} | Infos ${infoCount}</div>`;
        return;
    }

    out.innerHTML += `<div>Unknown command</div>`;
    out.scrollTop = out.scrollHeight;
}


// ===============================================================
// FOCUS ENDPOINT (dropdown auto update)
// ===============================================================
function refreshFocusSelect() {
    focusSelect.innerHTML = `<option value="">--none--</option>`;
    Object.keys(endpointCounts).slice(0, 50).forEach(ep => {
        const opt = document.createElement("option");
        opt.value = ep;
        opt.textContent = ep;
        focusSelect.appendChild(opt);
    });
}


// ===============================================================
// EXPORT JSON
// ===============================================================
function downloadReport() {
    const report = {
        errorCount,
        warnCount,
        infoCount,
        latencyTimeline,
        endpointCounts,
        methodCounts,
        rateWindow
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "log_report.json";
    a.click();

    URL.revokeObjectURL(url);
}


// ===============================================================
// SESSION MANAGEMENT - FIXED FUNCTIONS
// ===============================================================

// 🔥 FIX 1: Added listSessions function
async function listSessions() {
    const res = await fetch("/api/sessions");
    if (!res.ok) return [];
    return await res.json();
}

// 🔥 FIX 2: Added downloadLatestPDF helper function
async function downloadLatestPDF() {
    const sessions = await listSessions();
    if (!sessions.length) {
        alert("No saved sessions!");
        return;
    }
    const latest = sessions[0].id;
    downloadPDF(latest);
}

// 🔥 DOWNLOAD PDF - WITH DEBUG
async function downloadPDF(id) {
    console.log("Downloading PDF for session:", id);
    
    try {
        const response = await fetch(`/api/session/${id}/report.pdf`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("PDF download failed:", response.status, errorText);
            alert(`Failed to download PDF: ${response.status}\n${errorText}`);
            return;
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_${id}_report.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log("PDF download successful!");
    } catch (error) {
        console.error("Error downloading PDF:", error);
        alert("Error downloading PDF: " + error.message);
    }
}


// ===============================================================
// SAVE SESSION TO BACKEND (SQLite)
// ===============================================================
async function saveCurrentSession() {
    const logBox = document.getElementById("logBox");
    const parsed = [];

    for (let node of logBox.children) {
        const text = node.textContent;
        parsed.push({
            line: text,
            level: text.includes("ERROR") ? "ERROR" :
                   text.includes("WARN") ? "WARN" : "INFO",
            latency: (text.match(/(\d+)ms/) || [null, null])[1],
            endpoint: (text.match(/\s(\/[A-Za-z0-9_\-\/\.]+)/) || [null, null])[1],
            method: (text.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/) || [null, null])[1]
        });
    }

    const name = prompt("Session name:", `session_${Date.now()}`);

    const res = await fetch("/api/save_session", {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ name, lines: parsed })
    });

    const j = await res.json();
    alert("Saved session: " + j.session_id);
}


// ===============================================================
// RESET STATE
// ===============================================================
function resetState() {
    errorCount = warnCount = infoCount = 0;

    latencyTimeline = [];
    endpointCounts = {};
    methodCounts = {};
    lineTimestamps = [];
    rateWindow = [];

    document.getElementById("logBox").innerHTML = "";
    document.getElementById("terminalOutput").innerHTML = "";

    if (pieChart) pieChart.destroy();
    if (lineChart) lineChart.destroy();
    if (rateChart) rateChart.destroy();
    if (endpointChart) endpointChart.destroy();
    if (methodChart) methodChart.destroy();

    pieChart = lineChart = rateChart = endpointChart = methodChart = null;
}


// ===============================================================
// STATIC CPU/MEM SIMULATION
// ===============================================================
setInterval(() => {
    cpu = Math.floor(20 + Math.random() * 60);
    mem = Math.floor(20 + Math.random() * 65);

    updateGauge("cpuCircle", "cpuValue", cpu);
    updateGauge("memCircle", "memValue", mem);
}, 300);

function updateGauge(circleId, valueId, value) {
    const circle = document.getElementById(circleId);
    const valueEl = document.getElementById(valueId);

    const maxOffset = 440;
    const offset = maxOffset - (maxOffset * value) / 100;

    if (circle) {
        circle.style.strokeDashoffset = offset;
        circle.style.filter = `drop-shadow(0 0 ${value / 5}px #00fcef)`;
    }

    if (valueEl) {
        valueEl.textContent = value;
    }
}


// ===============================================================
// SPEED SLIDER
// ===============================================================
function updateSpeedLabel(v) {
    streamSpeed = parseInt(v);
    const label = document.getElementById("speedValue");
    if (label) label.textContent = `${v}ms`;
}

function setPreset(v) {
    const slider = document.getElementById("speedSlider");
    if (slider) {
        slider.value = v;
        updateSpeedLabel(v);
    }
}


// ===============================================================
// CLEANUP ON CLOSE
// ===============================================================
window.addEventListener("beforeunload", () => {
    if (ev) ev.close();
    stopRPS();
});