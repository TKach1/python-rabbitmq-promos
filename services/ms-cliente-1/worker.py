import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from core.security.crypto_utils import decrypt_for_component
from core.amqp.connection import get_connection
from core.amqp.exchange_setup import QUEUE_NAMES, setup_topology


COMPONENT = "ms-cliente-1"
DB_PATH = Path(__file__).resolve().parent / "db.json"


def load_db() -> dict:
    if not DB_PATH.exists():
        return {"alerts": []}
    return json.loads(DB_PATH.read_text(encoding="utf-8"))


def save_db(db: dict) -> None:
    DB_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")


def handle(body: bytes) -> None:
    envelope = json.loads(body.decode("utf-8"))
    event_type = envelope["event_type"]
    if event_type.startswith("evento.alerta.enviar."):
        verified_payload = decrypt_for_component(envelope["payload"], envelope["origin"])
        payload = verified_payload
        db = load_db()
        db["alerts"].append(payload)
        save_db(db)
        print(f"[ALERTA] {payload.get('mensagem', 'alerta sem mensagem')}")
    elif event_type.startswith("evento.alerta.hot."):
        verified_payload = decrypt_for_component(envelope["payload"], envelope["origin"])
        payload = verified_payload
        db = load_db()
        db["alerts"].append(payload)
        save_db(db)
        print(f"[HOT DEAL] {payload.get('mensagem', 'hot deal sem mensagem')}")


def main() -> None:
    conn = get_connection()
    channel = conn.channel()
    setup_topology(channel)

    def callback(ch, method, _, body):
        try:
            handle(body)
        except Exception as exc:
            print(f"Erro ms-cliente: {exc}")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE_NAMES[COMPONENT], on_message_callback=callback)
    print("ms-cliente aguardando alertas...")
    channel.start_consuming()


if __name__ == "__main__":
    main()
