EXCHANGE_NAME = "promo_exchange"
EXCHANGE_TYPE = "topic"

QUEUE_NAMES = {
    "gateway": "q_gateway_retorno",
    "ms-promocao": "q_ms_promocao",
    "ms-notificacao": "q_ms_notificacao",
    "ms-ranking": "q_ms_ranking",
    "ms-cliente-1": "q_ms_cliente-1",
    "ms-cliente-2": "q_ms_cliente-2",
}


def setup_topology(channel) -> None:
    channel.exchange_declare(exchange=EXCHANGE_NAME, exchange_type=EXCHANGE_TYPE, durable=True)

    channel.queue_declare(queue=QUEUE_NAMES["gateway"], durable=True)
    channel.queue_bind(
        exchange=EXCHANGE_NAME,
        queue=QUEUE_NAMES["gateway"],
        routing_key="retorno.#",
    )

    channel.queue_declare(queue=QUEUE_NAMES["ms-promocao"], durable=True)
    channel.queue_bind(
        exchange=EXCHANGE_NAME,
        queue=QUEUE_NAMES["ms-promocao"],
        routing_key="comando.promocao.*",
    )

    channel.queue_declare(queue=QUEUE_NAMES["ms-notificacao"], durable=True)
    channel.queue_bind(
        exchange=EXCHANGE_NAME,
        queue=QUEUE_NAMES["ms-notificacao"],
        routing_key="evento.promocao.criada.*",
    )

    channel.queue_declare(queue=QUEUE_NAMES["ms-ranking"], durable=True)
    channel.queue_bind(
        exchange=EXCHANGE_NAME,
        queue=QUEUE_NAMES["ms-ranking"],
        routing_key="comando.ranking.*",
    )

    channel.queue_declare(queue=QUEUE_NAMES["ms-cliente-1"], durable=True)
    channel.queue_bind(
        exchange=EXCHANGE_NAME,
        queue=QUEUE_NAMES["ms-cliente-1"],
        routing_key="evento.alerta.enviar.eletronicos",
    )
    channel.queue_bind(
        exchange=EXCHANGE_NAME,
        queue=QUEUE_NAMES["ms-cliente-1"],
        routing_key="evento.alerta.enviar.moda",
    )

    channel.queue_declare(queue=QUEUE_NAMES["ms-cliente-2"], durable=True)
    channel.queue_bind(
        exchange=EXCHANGE_NAME,
        queue=QUEUE_NAMES["ms-cliente-2"],
        routing_key="evento.alerta.enviar.moda",
    )


