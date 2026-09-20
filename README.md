# BikeGer

Sistema da loja de peças e da oficina, no mesmo negócio.

## Como o dinheiro funciona

Valores internos são **inteiros em centavos**.

- `15990` → R$ 159,90
- `24990` → R$ 249,90

Não usamos `Number` decimal para somar preço. Isso evita `0.1 + 0.2`.

## Como o estoque funciona

Toda alteração passa pelo kardex:

- venda baixa estoque
- peça lançada na OS baixa estoque
- cancelamento devolve estoque
- entrada e ajuste também geram movimentação

O campo `currentStock` do produto **não é editado direto** na ficha. Ele muda só por operação.

## Subir frontend e backend no GitHub

Frontend e backend vão no **mesmo** repositório. Não pode haver `.git` dentro de `frontend/` nem de `backend/` — isso deixa a pasta vazia no GitHub.

Passo a passo: [docs/subir-frontend-e-backend.md](docs/subir-frontend-e-backend.md)

## Subir o projeto

```bash
docker compose up -d
cd backend && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

API: `http://localhost:4000`  
App: `http://localhost:5174`

O Mongo no compose escuta só em `127.0.0.1:27017`. Em qualquer máquina que não seja o notebook da loja, **apague o bloco `ports`** do `docker-compose.yml` — o banco não deve ficar na internet.

Copie `backend/.env.example` para `backend/.env`. Em produção estes valores são obrigatórios:

| Variável | Para que serve |
|---|---|
| `JWT_SECRET` | Assina o login. Sem chave forte o servidor recusa subir. |
| `FRONTEND_URL` | Origem do painel (CORS e retorno do Mercado Pago). |
| `API_PUBLIC_URL` | URL pública da API. Sem isso o webhook PIX aponta para localhost. |
| Mongo replica set | Em produção a API **recusa subir** se o Mongo for standalone. Use `docker compose up -d` (`rs0`). |
| `MP_WEBHOOK_SECRET` | HMAC das notificações do Mercado Pago. |
| `FOCUS_NFE_TOKEN` | Emissão NFC-e (opcional). Em produção o token não é gravado nos Ajustes. |

Backup diário (`mongodump`, 14 dias) e restore de teste: [docs/backup.md](docs/backup.md). NFC-e é opcional — deixe desligada em Ajustes se a loja não emite.

Também use `MP_ACCESS_TOKEN` (e `WHATSAPP_TOKEN`, se for a Cloud API) no `.env` de produção.

## Login

Senha de demonstração: `bikeger`

| Login | Perfil | Enxerga |
|---|---|---|
| `dono` | Dono | Tudo, inclusive equipe, custo e ajustes |
| `balcao` | Balcão | PDV, caixa, clientes, OS e recebimento |
| `mecanico` | Mecânico | Oficina, peças e histórico — sem caixa nem custo |

## Integrações

- **Mercado Pago**: cole o Access Token em Ajustes. PIX e Checkout Pro usam o valor em centavos e só convertem na borda da API.
- **Impressora térmica**: cupom 80mm no navegador + arquivo ESC/POS para spooler local.
