#!/usr/bin/env python3
"""
Webhook simple pour auto-deploy sur push Git.
Securise par token secret (header X-Deploy-Token).

Usage:
    python3 webhook-deploy.py --port 9000 --secret "ton-token-secret"
    
Configuration Git (ex: GitHub/GitLab):
    Webhook URL: http://ton-serveur:9000/deploy
    Secret: ton-token-secret
    Events: push
"""

import argparse
import hmac
import hashlib
import subprocess
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
AUTO_DEPLOY = os.path.join(SCRIPT_DIR, "auto-deploy.sh")
LOG_FILE = os.path.join(SCRIPT_DIR, "logs", "webhook-deploy.log")

# Couleurs ANSI
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
GRAY = "\033[90m"
RESET = "\033[0m"


def log(msg, level="INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] [{level}] {msg}"
    print(f"{GREEN if level == 'OK' else YELLOW if level == 'WARN' else CYAN if level == 'INFO' else RED if level == 'ERROR' else ''}{line}{RESET}")
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def run_deploy():
    if not os.path.isfile(AUTO_DEPLOY):
        log(f"❌ {AUTO_DEPLOY} introuvable", "ERROR")
        return False
    log("🚀 Lancement auto-deploy.sh...", "INFO")
    try:
        result = subprocess.run(
            ["bash", AUTO_DEPLOY],
            cwd=SCRIPT_DIR,
            capture_output=True,
            text=True,
            timeout=300
        )
        for line in result.stdout.splitlines():
            log(f"  {line}", "INFO")
        if result.returncode != 0:
            for line in result.stderr.splitlines():
                log(f"  ERR: {line}", "ERROR")
            log("❌ auto-deploy.sh a echoue", "ERROR")
            return False
        log("✅ auto-deploy.sh termine avec succes", "OK")
        return True
    except subprocess.TimeoutExpired:
        log("❌ Timeout (300s) depasse", "ERROR")
        return False
    except Exception as e:
        log(f"❌ Erreur: {e}", "ERROR")
        return False


class WebhookHandler(BaseHTTPRequestHandler):
    secret_token = None

    def do_POST(self):
        if self.path != "/deploy":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # Verifier le token secret si configure
        if self.secret_token:
            # GitHub: X-Hub-Signature-256, GitLab: X-Gitlab-Token, generique: X-Deploy-Token
            token_header = (
                self.headers.get("X-Hub-Signature-256", "")
                or self.headers.get("X-Gitlab-Token", "")
                or self.headers.get("X-Deploy-Token", "")
            )
            if token_header.startswith("sha256="):
                # Format GitHub
                expected = "sha256=" + hmac.new(
                    self.secret_token.encode(), body, hashlib.sha256
                ).hexdigest()
                if not hmac.compare_digest(expected, token_header):
                    log("❌ Token HMAC invalide", "ERROR")
                    self.send_response(403)
                    self.end_headers()
                    self.wfile.write(b"Forbidden")
                    return
            elif token_header != self.secret_token:
                log("❌ Token invalide", "ERROR")
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Forbidden")
                return

        log("📡 Webhook recu — declenchement du deploiement", "INFO")

        # Repondre immediatement pour ne pas bloquer le client
        self.send_response(202)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Deploy started\n")

        # Lancer le deploiement en arriere-plan
        run_deploy()

    def log_message(self, format, *args):
        # Desactiver les logs HTTP par defaut de BaseHTTPRequestHandler
        pass


def main():
    parser = argparse.ArgumentParser(description="Webhook auto-deploy")
    parser.add_argument("--port", type=int, default=9000, help="Port d ecoute (defaut: 9000)")
    parser.add_argument("--secret", type=str, default="", help="Token secret pour authentifier les webhooks")
    args = parser.parse_args()

    WebhookHandler.secret_token = args.secret

    server = HTTPServer(("0.0.0.0", args.port), WebhookHandler)
    log(f"🐕 Webhook deploy demarre sur le port {args.port}", "INFO")
    if args.secret:
        log("   Securise par token", "INFO")
    else:
        log("   ⚠️ PAS de securite (pas de token configure)", "WARN")
    log("   Endpoint: POST http://<IP>:<port>/deploy", "INFO")
    log("   Appuyez sur Ctrl+C pour arreter", "INFO")
    log("")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("Arret demande", "INFO")
        server.shutdown()


if __name__ == "__main__":
    main()
