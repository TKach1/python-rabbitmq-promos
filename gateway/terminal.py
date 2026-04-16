import json
import time
import uuid
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from core.amqp.connection import get_connection
from core.amqp.exchange_setup import EXCHANGE_NAME, QUEUE_NAMES, setup_topology
from core.security.crypto_utils import build_envelope, decrypt_for_component, encrypt_for_target

COMP = 'gateway'

def publish_command(channel, event_type: str, payload: dict) -> str:
    correlation_id = str(uuid.uuid4())
    encrypted_payload = encrypt_for_target(payload, source_component=COMP)
    envelope = build_envelope(
        event_type=event_type,
        origin=COMP,
        encrypted_payload=encrypted_payload,
        correlation_id=correlation_id,
    )
    channel.basic_publish(
        exchange=EXCHANGE_NAME,
        routing_key=event_type,
        body=json.dumps(envelope, ensure_ascii=True),
    )
    return correlation_id


def wait_response(channel, correlation_id: str, timeout_seconds: int = 6):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        method, _, body = channel.basic_get(queue=QUEUE_NAMES[COMP], auto_ack=False)
        if method:
            channel.basic_ack(delivery_tag=method.delivery_tag)
            envelope = json.loads(body.decode("utf-8"))
            if envelope.get("correlation_id") == correlation_id:
                payload = decrypt_for_component(envelope["encrypted_payload"], envelope["origin"])
                return envelope["event_type"], payload
        time.sleep(0.2)
    return None, {"erro": "Timeout aguardando resposta"}


def menu() -> str:
    print("\n=== Gateway Promos ===")
    print("2) Listar promocoes")
    print("3) Registrar promocao")
    print("4) Curtir promocao")
    print("5) Sair")
    return input("Escolha: ").strip()


def main() -> None:
    connection = get_connection()
    channel = connection.channel()
    setup_topology(channel)

    print("Gateway iniciado.")

    while True:
        option = menu()

        if option == "2":
            corr = publish_command(
                channel,
                event_type="comando.promocao.listar",
                payload={"acao": "listar"},
            )
            event_type, payload = wait_response(channel, corr)
            print(f"[{event_type}] {json.dumps(payload, ensure_ascii=False, indent=2)}")

        elif option == "3":
            promo_id = input("Promocao ID: ").strip()
            titulo = input("Titulo: ").strip()
            categoria = input("Categoria: ").strip()
            preco = float(input("Preco: ").strip())
            corr = publish_command(
                channel,
                event_type="comando.promocao.registrar",
                payload={
                    "id": promo_id,
                    "titulo": titulo,
                    "categoria": categoria,
                    "preco": preco,
                },
            )
            event_type, payload = wait_response(channel, corr)
            print(f"[{event_type}] {json.dumps(payload, ensure_ascii=False)}")

        elif option == "4":
            promo_id = input("Promocao ID para like: ").strip()
            corr = publish_command(
                channel,
                event_type="comando.ranking.pontuar",
                payload={"promocao_id": promo_id},
            )
            event_type, payload = wait_response(channel, corr)
            print(f"[{event_type}] {json.dumps(payload, ensure_ascii=False, indent=2)}")

        elif option == "5":
            break

        else:
            print("Opcao invalida.")

    connection.close()


if __name__ == "__main__":
    main()
