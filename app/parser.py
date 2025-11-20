import re

# ------------------------------------------------------------
# ULTRA-NEON PARSER v4
# Smart extraction of level, latency, endpoint, method, message
# ------------------------------------------------------------

# Matches:
#   [INFO] message...
#   [ERROR] Failed login (320ms)
#   WARN Something happened 120ms
#   GET /api/login 200ms
#   workerEnv.init()
#   mod_jk worker
# ------------------------------------------------------------

level_pattern = re.compile(r"\b(INFO|ERROR|WARN|WARNING)\b", re.IGNORECASE)
latency_pattern = re.compile(r"(\d+)ms")
method_pattern = re.compile(r"\b(GET|POST|PUT|PATCH|DELETE)\b", re.IGNORECASE)
endpoint_pattern = re.compile(r"\s(/[A-Za-z0-9_\-\/\.]+)")

fallback_endpoint_pattern = re.compile(
    r"\b([a-zA-Z_]+(?:_init|Env|worker|mod|child)?)\b"
)


def parse_line(line: str):
    """Return parsed object used by frontend + DB."""

    # LEVEL ---------------------------------------
    level_match = level_pattern.search(line)
    level = level_match.group(1).upper() if level_match else "INFO"

    # LATENCY -------------------------------------
    latency_match = latency_pattern.search(line)
    latency = int(latency_match.group(1)) if latency_match else None

    # METHOD --------------------------------------
    method_match = method_pattern.search(line)
    method = method_match.group(1).upper() if method_match else None

    # ENDPOINT ------------------------------------
    endpoint = "unknown"
    path_match = endpoint_pattern.search(line)
    if path_match:
        endpoint = path_match.group(1)
    else:
        fb = fallback_endpoint_pattern.search(line)
        if fb:
            endpoint = fb.group(1)

    # MESSAGE -------------------------------------
    clean = line.strip()

    return {
        "line": clean,
        "level": level,
        "latency": latency,
        "method": method,
        "endpoint": endpoint,
    }
