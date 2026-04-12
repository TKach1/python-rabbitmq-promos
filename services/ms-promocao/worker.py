import json
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[2]))

from core.amqp.connection import get_connection
from core.amqp.exchange_setup import EXCHANGE_NAME, QUEUE_NAMES, setup_topology
from core.security.crypto_utils import build_envelope, decrypt_for_component, encrypt_for_target


COMPONENT = "ms-promocao"
DB_PATH = Path(__file__).resolve().parent / "db.json"


def load_db() -> dict:
    if not DB_PATH.exists():
        return {"promocoes": []}
    return json.loads(DB_PATH.read_text(encoding="utf-8"))


def save_db(db: dict) -> None:
    DB_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")


def publish(channel, event_type: str, target: str, payload: dict, correlation_id: str) -> None:
    encrypted_payload = encrypt_for_target(payload, target)
    envelope = build_envelope(
        event_type=event_type,
        origin=COMPONENT,
        target=target,
        encrypted_payload=encrypted_payload,
        correlation_id=correlation_id,
    )
    channel.basic_publish(
        exchange=EXCHANGE_NAME,
        routing_key=event_type,
        body=json.dumps(envelope, ensure_ascii=True),
    )


def handle(channel, body: bytes) -> None:
    envelope = json.loads(body.decode("utf-8"))
    event_type = envelope["event_type"]
    correlation_id = envelope["correlation_id"]

    payload = decrypt_for_component(envelope["encrypted_payload"], COMPONENT)
    db = load_db()

    if event_type == "comando.promocao.registrar":
        promo = {
            "id": payload["id"],
            "titulo": payload["titulo"],
            "categoria": payload["categoria"],
            "preco": payload["preco"],
        }
        db["promocoes"].append(promo)
        save_db(db)

        publish(
            channel,
            event_type="retorno.promocao.registro",
            target="gateway",
            payload={"status": "ok", "promocao": promo},
            correlation_id=correlation_id,
        )

        publish(
            channel,
            event_type=f"evento.promocao.criada.{promo['categoria']}",
            target="ms-notificacao",
            payload={"promocao": promo},
            correlation_id=correlation_id,
        )

    elif event_type == "comando.promocao.listar":
        publish(
            channel,
            event_type="retorno.promocao.lista",
            target="gateway",
            payload={"promocoes": db["promocoes"]},
            correlation_id=correlation_id,
        )


def main() -> None:
    conn = get_connection()
    channel = conn.channel()
    setup_topology(channel)

    def callback(ch, method, _, body):
        try:
            handle(ch, body)
        except Exception as exc:
            print(f"Erro ms-promocao: {exc}")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE_NAMES[COMPONENT], on_message_callback=callback)
    print("ms-promocao aguardando mensagens...")
    channel.start_consuming()


if __name__ == "__main__":
    main()
