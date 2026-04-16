# Python RabbitMQ Promos

Projeto de demonstração de arquitetura orientada a eventos com RabbitMQ usando Python. O fluxo simula cadastro de promoções, notificação de clientes por categoria de interesse e ranking de curtidas.

## Objetivo

- Demonstrar comunicação assíncrona entre microsserviços.
- Usar roteamento por tópicos (topic exchange) para separar eventos e comandos.
- Aplicar assinatura digital RSA-PSS entre gateway e serviços de backend.
- Simular preferências de usuários diretamente no binding do exchange.

## Arquitetura

Componentes:

- gateway: interface de terminal para enviar comandos e receber respostas.
- ms-promocao: registra e lista promoções.
- ms-notificacao: recebe evento de promoção criada e dispara alertas por categoria.
- ms-ranking: pontua promoções curtidas e devolve ranking.
- ms-cliente-1: consumidor de alertas do cliente 1.
- ms-cliente-2: consumidor de alertas do cliente 2.
- rabbitmq: broker de mensagens com plugin de management.

Exchange principal:

- Nome: promo_exchange
- Tipo: topic
- Definição: core/amqp/exchange_setup.py

## Sistema de 2 usuários com preferências manuais no exchange

As preferências dos dois usuários sao configuradas manualmente nos bindings das filas em core/amqp/exchange_setup.py.

Bindings atuais:

- ms-cliente-1 recebe:
  - evento.alerta.enviar.eletronicos
  - evento.alerta.enviar.moda
- ms-cliente-2 recebe:
  - evento.alerta.enviar.moda

Significado prático:

- Cliente 1 está inscrito em eletronicos e moda.
- Cliente 2 está inscrito apenas em moda.

Como isso funciona no fluxo:

1. Uma promoção é registrada em ms-promocao.
2. ms-promocao publica evento.promocao.criada.<categoria>.
3. ms-notificacao consome e publica evento.alerta.enviar.<categoria>.
4. O RabbitMQ entrega somente para as filas cujos bindings casam com a routing key.

Para alterar preferências manualmente, edite os queue_bind de ms-cliente-1 e ms-cliente-2 em core/amqp/exchange_setup.py.

## Segurança das mensagens

Modelo de assinatura digital RSA-PSS (sign & verify):

- O componente de origem assina o payload com sua chave privada (`encrypt_for_target`).
- O componente receptor verifica a assinatura usando a chave pública do remetente (`decrypt_for_component`).
- Isso garante autenticidade e integridade: o receptor confirma que a mensagem veio do remetente esperado e nao foi alterada.
- Se a assinatura for inválida, `InvalidSignature` é lançado.

Formato do bundle assinado (campo `encrypted_payload` do envelope):

- Base64 de um JSON com dois campos:
  - `payload`: conteúdo original em base64.
  - `signature`: assinatura RSA-PSS/SHA-256 em base64.

Componentes com chaves RSA: gateway, ms-promocao, ms-notificacao, ms-ranking.
ms-cliente-1 e ms-cliente-2 nao usam criptografia e nao possuem par de chaves.

Chaves privadas (usadas para assinar):

- gateway/keys/private.pem
- services/ms-promocao/keys/private.pem
- services/ms-notificacao/keys/private.pem
- services/ms-ranking/keys/private.pem

Chaves públicas (usadas para verificar assinatura):

- core/security/keys/gateway_public.pem
- core/security/keys/ms-promocao_public.pem
- core/security/keys/ms-notificacao_public.pem
- core/security/keys/ms-ranking_public.pem

Mensagens de alerta para os clientes sao enviadas em payload puro (sem encrypted_payload).

Scripts relevantes:

- scripts/generate_keys.py: gera os pares de chaves.
- core/security/crypto_utils.py: assinatura, verificação e montagem de envelope.

## Requisitos

- Python 3.10+
- Docker e Docker Compose

Dependências Python:

- pika==1.3.2
- cryptography==42.0.8

## Como executar

1. Suba o RabbitMQ:

	docker compose up -d rabbitmq

2. Instale dependências:

	pip install -r requirements.txt

3. Gere as chaves RSA:

	python scripts/generate_keys.py

4. Em terminais separados, rode os serviços:

	python services/ms-promocao/worker.py

	python services/ms-notificacao/worker.py

	python services/ms-ranking/worker.py

	python services/ms-cliente-1/worker.py

	python services/ms-cliente-2/worker.py

	python gateway/terminal.py

5. No gateway, use o menu:

- 2: listar promocoes
- 3: registrar promocao
- 4: curtir promocao
- 5: sair

## Exemplo rápido de teste das preferências

1. Cadastre uma promoção na categoria eletronicos.
2. Verifique os logs:
	- ms-cliente-1 deve receber alerta.
	- ms-cliente-2 nao deve receber alerta.
3. Cadastre uma promoção na categoria moda.
4. Verifique os logs:
	- ms-cliente-1 deve receber alerta.
	- ms-cliente-2 deve receber alerta.

## Observabilidade

Painel do RabbitMQ:

- URL: http://localhost:15672
- Usuario: guest
- Senha: guest

No painel, confira exchange, filas e bindings para validar o roteamento por categoria.

## Estrutura resumida

- core/amqp: conexão e topologia do RabbitMQ.
- core/security: criptografia e chaves públicas.
- gateway: interface de terminal e chave privada do gateway.
- services: workers de cada microsserviço.
- scripts: automação de bootstrap e geração de chaves.

## Run concurrently

```sh
$ concurrently 'python services/ms-promocao/worker.py' 'python services/ms-notificacao/worker.py' 'python services/ms-ranking/worker.py' 'python services/ms-cliente-1/worker.py' 'python services/ms-cliente-2/worker.py' 'python gateway/terminal.py'
```