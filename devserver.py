#!/usr/bin/env python3
"""Servidor local com fallback SPA para app.html (imita o rewrite do Vercel).

Uso: python devserver.py [porta]   (porta padrao 8080)
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

# Prefixos/arquivos reais que devem ser servidos diretamente
REAL_PREFIXES = ("/assets", "/css", "/js", "/migrations", "/supabase")
REAL_FILES = ("/index.html", "/app.html", "/favicon.ico")


class SPAHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        real = (
            path == "/"
            or path in REAL_FILES
            or path.startswith(REAL_PREFIXES)
            or "." in os.path.basename(path)
        )
        if not real:
            # Rota do app (ex.: /usuarios) -> entrega o shell app.html
            self.path = "/app.html"
        return super().do_GET()


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print(f"Servindo com fallback SPA em http://localhost:{PORT}")
    ThreadingHTTPServer(("", PORT), SPAHandler).serve_forever()
