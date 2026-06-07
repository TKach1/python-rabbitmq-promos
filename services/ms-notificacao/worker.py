import json
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[2]))
import resend
from core.amqp.connection import get_connection
from core.amqp.exchange_setup import EXCHANGE_NAME, QUEUE_NAMES, setup_topology
from core.security.crypto_utils import build_envelope, decrypt_for_component, encrypt_for_target

resend.api_key = "re_DUyDn4jz_JKWG4m8583kuFAic36yW6Yw2"
COMPONENT = "ms-notificacao"
DB_PATH = Path(__file__).resolve().parent / "db.json"


def load_db() -> dict:
    if not DB_PATH.exists():
        return {"subscriptions": {}, "interesses": {}}
    return json.loads(DB_PATH.read_text(encoding="utf-8"))


def save_db(db: dict) -> None:
    DB_PATH.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")


def publish(channel, event_type: str, payload: dict, correlation_id: str) -> None:
    encrypted_payload = encrypt_for_target(payload, source_component=COMPONENT)
    envelope = build_envelope(
        event_type=event_type,
        origin=COMPONENT,
        encrypted_payload="",
        correlation_id=correlation_id,
    )
    envelope["payload"] = encrypted_payload
    channel.basic_publish(
        exchange=EXCHANGE_NAME,
        routing_key=event_type,
        body=json.dumps(envelope, ensure_ascii=True),
    )


def handle(channel, body: bytes) -> None:
    envelope = json.loads(body.decode("utf-8"))
    event_type = envelope["event_type"]
    correlation_id = envelope["correlation_id"]

    payload = decrypt_for_component(envelope["encrypted_payload"], envelope["origin"])
    db = load_db()

    if event_type.startswith("evento.promocao.criada."):
        promo = payload["promocao"]
        categoria = promo["categoria"]

        alerta = {
            "mensagem": f"Nova promocao em {categoria}: {promo['titulo']}",
            "promocao": promo,
        }
        print(f"Enviando alerta para clientes interessados em {categoria}...")
        publish(
            channel,
            event_type=f"evento.alerta.enviar.{categoria}",
            payload=alerta,
            correlation_id=correlation_id,
        )
        
    elif event_type.startswith("evento.alerta.hot."):
        promo = payload["promocao"]
        categoria = promo["categoria"]
        
        alerta = {
            "mensagem": f"Nova promocao em {categoria}: {promo['id']} com ranking {promo['ranking']}",
            "promocao": promo,
        }
        print(f"Enviando alerta de HOT DEAL! para a loja, categoria: {categoria}...")

        html = f"<p>Sua promoção <strong>em {categoria} id: {promo.get('id')}</strong>! se tornou HOT DEAL!</p>"
        r = resend.Emails.send({
            "from": "onboarding@resend.dev",
            "to": "williamrodrigues4224@gmail.com",
            "subject": "Alerta HOT DEAL!",
            "html": html,
        })



        publish(
            channel,
            event_type=f"evento.alerta.enviar.{categoria}",
            payload=alerta,
            correlation_id=correlation_id,
        )
    
    elif event_type == "comando.interesse.registrar":
        usuario_id = payload.get("usuario_id")
        categoria = payload.get("categoria")
        if usuario_id and categoria:
            if usuario_id not in db["interesses"]:
                db["interesses"][usuario_id] = []
            if categoria not in db["interesses"][usuario_id]:
                db["interesses"][usuario_id].append(categoria)
            save_db(db)
            print(f"Interesse registrado: {usuario_id} -> {categoria}")
    
    elif event_type == "comando.interesse.cancelar":
        usuario_id = payload.get("usuario_id")
        categoria = payload.get("categoria")
        if usuario_id and categoria:
            if usuario_id in db["interesses"] and categoria in db["interesses"][usuario_id]:
                db["interesses"][usuario_id].remove(categoria)
                if not db["interesses"][usuario_id]:
                    del db["interesses"][usuario_id]
                save_db(db)
                print(f"Interesse cancelado: {usuario_id} -> {categoria}")


def main() -> None:
    conn = get_connection()
    channel = conn.channel()
    setup_topology(channel)

    def callback(ch, method, _, body):
        try:
            handle(ch, body)
        except Exception as exc:
            print(f"Erro ms-notificacao: {exc}")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE_NAMES[COMPONENT], on_message_callback=callback)
    print("ms-notificacao aguardando mensagens...")
    channel.start_consuming()


if __name__ == "__main__":
    main()
