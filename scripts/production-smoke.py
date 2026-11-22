"""Verify a copied runtime with production-only dependencies; no providers/accounts.

Uses a new directory under BH_AGENT_WORKSPACE/Hermes scratch, never prunes the
working checkout. The synthetic invitation is generated in memory and not logged.
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
STAMP = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
SCRATCH = Path.home() / ".hermes/cache/scratch" / f"jw-production-{STAMP}"
SCRATCH.mkdir(mode=0o700, parents=True)
EVIDENCE = ROOT / "docs/evidence"
EVIDENCE.mkdir(parents=True, exist_ok=True)
report: dict = {
    "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    "runtimeDirectory": str(SCRATCH),
    "scope": "Fresh production-only dependency install and loopback HTTP; no provider or exchange calls.",
    "checks": [],
    "status": "running",
}
checks = report["checks"]
child = None


def check(name: str, condition: bool) -> None:
    checks.append({"name": name, "status": "pass" if condition else "fail"})
    if not condition:
        raise AssertionError(name)


def sha(file: Path) -> str:
    return hashlib.sha256(file.read_bytes()).hexdigest()


try:
    for name in ["package.json", "package-lock.json", "server.ts"]:
        shutil.copy2(ROOT / name, SCRATCH / name)
    for name in ["server", "src", "dist"]:
        shutil.copytree(ROOT / name, SCRATCH / name)
    report["packageLockSha256"] = sha(SCRATCH / "package-lock.json")
    report["entrySha256"] = sha(SCRATCH / "server.ts")
    base = {
        "HOME": str(Path.home()),
        "PATH": os.pathsep.join([str(Path.home() / ".local/bin"), "/opt/homebrew/bin", "/usr/bin", "/bin"]),
        "TMPDIR": str(SCRATCH),
        "LANG": "en_US.UTF-8",
    }
    npm = shutil.which("npm", path=base["PATH"])
    node = shutil.which("node", path=base["PATH"])
    check("node/npm available", bool(npm and node))
    assert npm is not None and node is not None  # Narrow optional paths for static analysis.
    with (EVIDENCE / "production-clean-install.log").open("w") as log:
        install = subprocess.run(
            [npm, "ci", "--omit=dev", "--ignore-scripts", "--no-fund", "--no-audit"],
            cwd=SCRATCH, env=base, stdout=log, stderr=subprocess.STDOUT, timeout=160,
        )
    report["installExit"] = install.returncode
    check("npm ci production-only exits zero", install.returncode == 0)
    for name in ["vite", "@vitejs/plugin-react", "@playwright/test", "picomatch", "tailwindcss"]:
        check(f"build-only package absent: {name}", not (SCRATCH / "node_modules" / name).exists())
    check("tsx runtime package present", (SCRATCH / "node_modules/tsx").is_dir())
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    token = secrets.token_urlsafe(32)
    auth = "Basic " + base64.b64encode(f"prakom:{token}".encode()).decode()
    env = {
        **base,
        "NODE_ENV": "production", "HOST": "127.0.0.1", "PORT": str(port),
        "ALLOWED_HOSTS": f"127.0.0.1:{port}", "AI_PROVIDER": "none",
        "RANKING_PUBLISH_ENABLED": "false", "PILOT_ACCESS_TOKEN": token,
        "PILOT_ALLOWED_TARGETS": "example.com",
    }
    child = subprocess.Popen(
        [node, "--import", "tsx", "server.ts"], cwd=SCRATCH, env=env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    origin = f"http://127.0.0.1:{port}"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(path: str, authorized: bool = False, payload=None, host=None):
        headers = {}
        if authorized:
            headers["Authorization"] = auth
        if host:
            headers["Host"] = host
        data = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(payload).encode()
        req = urllib.request.Request(origin + path, data=data, headers=headers)
        try:
            with opener.open(req, timeout=2) as res:
                return res.status, res.read(), dict(res.headers)
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read(), dict(exc.headers)

    ready = False
    for _ in range(100):
        if child.poll() is not None:
            break
        try:
            if request("/api/health")[0] == 200:
                ready = True
                break
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        time.sleep(0.05)
    check("production-only runtime starts on loopback", ready)
    status, body, _ = request("/api/health")
    check("health remains available and correct", status == 200 and json.loads(body)["methodology"] == "technical-v1")
    check("HTML requires invitation", request("/")[0] == 401)
    check("API requires invitation", request("/api/audit/analyze", payload={})[0] == 401)
    status, body, headers = request("/", authorized=True)
    check("authorized HTML served from dist", status == 200 and b'<div id="root">' in body)
    check("security headers present", headers.get("X-Frame-Options") == "DENY" and headers.get("X-Content-Type-Options") == "nosniff")
    js_file = next((SCRATCH / "dist/assets").glob("*.js"))
    check("asset requires invitation", request("/assets/" + js_file.name)[0] == 401)
    status, body, _ = request("/assets/" + js_file.name, authorized=True)
    check("authorized JS asset bytes match build", status == 200 and hashlib.sha256(body).hexdigest() == sha(js_file))
    check("host allowlist rejects wrong host", request("/api/health", host="unapproved.invalid")[0] == 403)
    check("off-pilot target denied before external call", request(
        "/api/audit/analyze", authorized=True,
        payload={"url": "https://outside-site.com/", "category": "umum", "strategy": "MOBILE"},
    )[0] == 400)
    check("browser supplied score rejected", request(
        "/api/audit/analyze", authorized=True,
        payload={"url": "https://example.com/", "category": "umum", "strategy": "MOBILE", "totalScore": 100},
    )[0] == 400)
    child.terminate()
    child.wait(timeout=5)
    check("owned production runtime stopped", child.poll() is not None)
    unsafe = {**env, "HOST": "0.0.0.0", "PILOT_ACCESS_TOKEN": "", "PILOT_ALLOWED_TARGETS": ""}
    rejected = subprocess.run(
        [node, "--import", "tsx", "server.ts"], cwd=SCRATCH, env=unsafe,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5,
    )
    check("non-loopback missing invite and targets fails before listen", rejected.returncode == 1)
    report["status"] = "pass"
except Exception as exc:
    report["status"] = "fail"
    report["failure"] = f"{type(exc).__name__}: {exc}"
finally:
    if child is not None and child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=5)
    report["ownedRuntimeStopped"] = child is None or child.poll() is not None
    (EVIDENCE / "production-clean-runtime.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))

raise SystemExit(0 if report["status"] == "pass" else 1)
