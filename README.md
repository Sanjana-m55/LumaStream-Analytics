# LumaStream Analytics

> Real-time log analysis and visualization dashboard with cyberpunk-inspired interface

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.68+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [License](#license)

## 🎯 Overview

LumaStream Analytics is a web-based log analyzer that processes system logs in real-time, providing insights into API performance, anomaly detection, and system health monitoring through an interactive neon-themed dashboard.

## ✨ Features

- **Real-time Log Streaming** - Upload and process logs with configurable playback speeds
- **Anomaly Detection** - ML-based detection with adjustable sensitivity
- **Interactive Terminal** - Execute queries and commands on log data
- **Multi-format Export** - Generate PDF reports and JSON exports
- **System Monitoring** - Live CPU and memory usage tracking
- **Pattern Matching** - Search using keywords or regex patterns

## 🛠 Tech Stack

**Backend:**
- FastAPI - Modern Python web framework
- Uvicorn - ASGI server
- SQLite - Data persistence
- ReportLab - PDF generation

**Frontend:**
- Vanilla JavaScript
- Chart.js - Data visualization
- Custom CSS3 - Neon cyberpunk theme

## 📦 Installation

### Prerequisites

- Python 3.8+
- pip package manager

### Quick Start
```bash
# Clone repository
git clone <repository-url>
cd log-analyzer

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run application
python main.py

# Access dashboard
# http://127.0.0.1:8000
```

### Dependencies
```txt
fastapi
uvicorn
python-multipart
psutil
reportlab
```

## 🚀 Usage

### Upload & Stream Logs

1. Click **UPLOAD LOG** button
2. Select `.log` file
3. Click **START** to begin streaming
4. Use **PAUSE/RESUME** for playback control

### Terminal Commands
```bash
error              # Show error logs
warning            # Show warnings
endpoint_usage     # Display API endpoint stats
show endpoints /api/.*  # Regex filtering
```

### Export Options

- **SAVE SESSION** - Persist analysis state
- **DOWNLOAD PDF** - Generate report
- **DOWNLOAD JSON** - Export raw data

## 📚 API Documentation

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload log file |
| POST | `/start` | Start streaming |
| POST | `/pause` | Pause playback |
| POST | `/resume` | Resume streaming |
| POST | `/stop` | Stop streaming |
| GET | `/logs` | Fetch processed logs |
| GET | `/stats` | System statistics |
| GET | `/health` | Health metrics |

## 📁 Project Structure
```
log-analyzer/
├── app/
│   ├── __init__.py
│   ├── routes/
│   ├── static/
│   │   ├── index.html
│   │   ├── neon.css
│   │   └── neon.js
│   ├── persist.py
│   └── stream.py
├── main.py
├── parser.py
├── requirements.txt
└── README.md
```

## ⚙️ Configuration

### Log Format

Expected format:
```
[TIMESTAMP] LEVEL: MESSAGE
```

Example:
```
[2025-11-20 10:45:23] INFO: System initialized
[2025-11-20 10:45:25] ERROR: Connection timeout
```

### Custom Patterns

Modify `parser.py` for custom formats:
```python
LOG_PATTERN = r'\[(?P<timestamp>.*?)\] (?P<level>\w+): (?P<message>.*)'
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/name`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/name`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 📧 Contact

For issues or questions, open an issue on GitHub.

---
