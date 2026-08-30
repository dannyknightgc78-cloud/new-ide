#!/usr/bin/env python3
"""Serve Queendar dist/ on Vultr (SPA fallback)."""
import http.server
import os
import socketserver

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
PORT = int(os.environ.get("QUEENDAR_PORT", "8802"))
BIND = os.environ.get("QUEENDAR_BIND", "127.0.0.1")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, fmt, *args):
        print(f"[queendar:{PORT}] {self.address_string()} - {fmt % args}")


class ReuseServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    if not os.path.isfile(os.path.join(ROOT, "index.html")):
        raise SystemExit(f"Missing {ROOT}/index.html — run npm run build first")
    with ReuseServer((BIND, PORT), Handler) as httpd:
        print(f"Queendar serving {ROOT} on http://{BIND}:{PORT}/")
        httpd.serve_forever()
