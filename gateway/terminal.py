import json
import queue
import threading
import time
import uuid
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
sys.path.append(str(Path(__file__).resolve().parents[1]))
from fastapi.middleware.cors import CORSMiddleware
from core.amqp.connection import get_connection
from core.amqp.exchange_setup import EXCHANGE_NAME, QUEUE_NAMES, setup_topology
from core.security.crypto_utils import build_envelope, decrypt_for_component, encrypt_for_target

COMP = 'gateway'
channel = None
sse_clients = {}
sse_lock = threading.Lock()

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

#Função que empurra o alerta recebido para os clientes SSE conectados
def broadcast_sse(event_type: str, data: dict):
    with sse_lock:
        dead_clients = []
        for client_id, client_queue in sse_clients.items():
            try:
                client_queue.put_nowait((event_type, data))
            except Exception:
                dead_clients.append(client_id)
        for client_id in dead_clients:
            sse_clients.pop(client_id, None)



#Aqui o gateway consome os alertas recebidos do ms notificação e faz um broadcast
#para a fila dos clientes

def consume_alerts(alert_channel):
    def callback(ch, method, _, body):
        try:
            envelope = json.loads(body.decode("utf-8"))
            event_type = envelope.get("event_type", "")
            if event_type.startswith("evento.alerta.enviar."):
                payload = decrypt_for_component(envelope.get("encrypted_payload", ""), envelope.get("origin", ""))
                categoria = event_type.split(".")[-1]
                
                
                #Quando um alerta de promoção é recebido, faz um broadcast para todos os clientes na fila do SSE
                broadcast_sse("alerta", {
                    "categoria": categoria,
                    "mensagem": payload.get("mensagem", ""),
                    "promocao": payload.get("promocao", {}),
                })
        
        
        except Exception as exc:
            print(f"Erro ao processar alerta SSE: {exc}")
        finally:
            ch.basic_ack(delivery_tag=method.delivery_tag)

    alert_channel.basic_qos(prefetch_count=1)
    alert_channel.basic_consume(queue=QUEUE_NAMES["gateway_alertas"], on_message_callback=callback)
    alert_channel.start_consuming()


#def menu() -> str:
#    print("\n=== Gateway Promos ===")
#    print("2) Listar promocoes")
#    print("3) Registrar promocao")
#    print("4) Curtir promocao")
#    print("5) Sair")
#    return input("Escolha: ").strip()


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("startup")
async def startup():
    global channel
    connection = get_connection()
    channel = connection.channel()
    setup_topology(channel)

    alert_connection = get_connection()
    alert_channel = alert_connection.channel()
    setup_topology(alert_channel)
    alert_thread = threading.Thread(target=consume_alerts, args=(alert_channel,), daemon=True)
    alert_thread.start()


@app.get("/listar_promocoes")
async def listar_promocoes():

    corr = publish_command(
        channel,
        event_type="comando.promocao.listar",
        payload={"acao": "listar"},
    )
    event_type, payload = wait_response(channel, corr)
    return {"event_type": event_type, "payload": payload}


@app.post("/registrar_promocao")
async def registrar_promocao(body: dict):
    promo_id = body.get("id")
    titulo = body.get("titulo")
    categoria = body.get("categoria")
    preco = body.get("preco")
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
    return {"event_type": event_type, "payload": payload}


@app.post("/votar_promocao")
async def votar_promocao(body: dict):
    promo_id = body.get("promocao_id")
    positivo = body.get("positivo", True)
    if not promo_id:
        raise HTTPException(status_code=400, detail="promocao_id é obrigatório")
    delta = 1 if positivo else -1
    corr = publish_command(
        channel,
        event_type="comando.ranking.pontuar",
        payload={"promocao_id": promo_id, "delta": delta},
    )
    event_type, payload = wait_response(channel, corr)
    return {"event_type": event_type, "payload": payload}


@app.post("/interesse/categoria")
async def registrar_interesse_categoria(body: dict):
    usuario_id = body.get("usuario_id")
    categoria = body.get("categoria")
    if not usuario_id or not categoria:
        raise HTTPException(status_code=400, detail="usuario_id e categoria são obrigatórios")

    publish_command(
        channel,
        event_type="comando.interesse.registrar",
        payload={"usuario_id": usuario_id, "categoria": categoria},
    )
    return {"status": "ok", "usuario_id": usuario_id, "categoria": categoria}


@app.delete("/interesse/categoria")
async def cancelar_interesse_categoria(body: dict):
    usuario_id = body.get("usuario_id")
    categoria = body.get("categoria")
    if not usuario_id or not categoria:
        raise HTTPException(status_code=400, detail="usuario_id e categoria são obrigatórios")

    publish_command(
        channel,
        event_type="comando.interesse.cancelar",
        payload={"usuario_id": usuario_id, "categoria": categoria},
    )
    return {"status": "ok", "usuario_id": usuario_id, "categoria": categoria}




#Gateway recebe alerta AMQP
#chama broadcast_sse(...)
#StreamingResponse envia o evento SSE ao front
#EventSource no browser recebe esse evento.






@app.get("/subscribe/notificacoes/{client_id}")
async def subscribe_notificacoes(client_id: str):
    client_queue = queue.Queue()

    with sse_lock:
        sse_clients[client_id] = client_queue

    def event_generator():
        try:
            while True:
                try:
                    event_type, data = client_queue.get(timeout=30)
                    yield f"event: {event_type}\n"
                    yield f"data: {json.dumps(data)}\n\n"
                except queue.Empty:
                    yield ": keep-alive\n\n"
        finally:
            with sse_lock:
                sse_clients.pop(client_id, None)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


