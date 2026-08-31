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

## Subir o projeto

```bash
docker compose up -d
cd backend && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

API: `http://localhost:4000`  
App: `http://localhost:5174`

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
