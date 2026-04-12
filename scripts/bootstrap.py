#!/usr/bin/env python3
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PYTHON = sys.executable


PROCESSES = [
    ("ms-promocao", [PYTHON, "services/ms-promocao/worker.py"]),
    ("ms-notificacao", [PYTHON, "services/ms-notificacao/worker.py"]),
    ("ms-ranking", [PYTHON, "services/ms-ranking/worker.py"]),
    ("ms-cliente-1", [PYTHON, "services/ms-cliente-1/worker.py"]),
    ("ms-cliente-2", [PYTHON, "services/ms-cliente-2/worker.py"]),
    ("gateway", [PYTHON, "gateway/terminal.py"]),
]


def run_step(command: list[str], name: str) -> None:
    print(f"[bootstrap] executando: {name}")
    result = subprocess.run(command, cwd=REPO_ROOT, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Falha em '{name}' (exit={result.returncode})")


def stream_output(name: str, pipe) -> None:
    for line in iter(pipe.readline, ""):
        print(f"[{name}] {line.rstrip()}")
    pipe.close()


def start_processes() -> list[subprocess.Popen]:
    running: list[subprocess.Popen] = []
    for name, cmd in PROCESSES:
        proc = subprocess.Popen(
            cmd,
            cwd=REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=os.environ.copy(),
        )
        thread = threading.Thread(target=stream_output, args=(name, proc.stdout), daemon=True)
        thread.start()
        running.append(proc)
        time.sleep(0.2)
    return running


def stop_processes(processes: list[subprocess.Popen]) -> None:
    for proc in processes:
        if proc.poll() is None:
            proc.terminate()

    deadline = time.time() + 5
    for proc in processes:
        while proc.poll() is None and time.time() < deadline:
            time.sleep(0.1)

    for proc in processes:
        if proc.poll() is None:
            proc.kill()


def main() -> None:
    try:
        run_step(["docker", "compose", "up", "-d", "rabbitmq"], "subir rabbitmq")
        run_step([PYTHON, "scripts/generate_keys.py"], "gerar chaves rsa")
    except Exception as exc:
        print(f"[bootstrap] erro: {exc}")
        sys.exit(1)

    print("[bootstrap] iniciando workers e gateway...")
    processes = start_processes()

    def _handle_signal(signum, _frame):
        print(f"\n[bootstrap] sinal {signum} recebido. Encerrando processos...")
        stop_processes(processes)
        sys.exit(0)

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        while True:
            for proc in processes:
                if proc.poll() is not None:
                    print("[bootstrap] um processo finalizou inesperadamente. Encerrando todos.")
                    stop_processes(processes)
                    sys.exit(proc.returncode or 1)
            time.sleep(0.5)
    except KeyboardInterrupt:
        _handle_signal(signal.SIGINT, None)


if __name__ == "__main__":
    main()
