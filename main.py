import os
from urllib.parse import urlparse

from flask import Flask, jsonify, render_template, request
from waitress import serve

app = Flask(__name__)


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.post("/validate-url")
def validate_url():
    payload = request.get_json(silent=True) or {}
    raw_url = str(payload.get("url", "")).strip()

    if not raw_url:
        return jsonify({"ok": False, "reason": "Please provide a stream URL."}), 400

    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return jsonify({"ok": False, "reason": "URL must start with http:// or https://."}), 400

    if ".m3u8" not in raw_url.lower():
        return jsonify({"ok": False, "reason": "URL should point to an HLS .m3u8 playlist."}), 400

    return jsonify({"ok": True})


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8080"))

    if host == "0.0.0.0":
        display_host = "127.0.0.1"
    else:
        display_host = host

    print(f"HLS Player is running at: http://{display_host}:{port}", flush=True)
    serve(app, host=host, port=port)
