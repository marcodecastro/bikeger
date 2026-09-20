# Subir frontend e backend no mesmo repositório

Frontend (`frontend/`) e backend (`backend/`) vão no **mesmo** `.git` na raiz. Não pode haver `.git` dentro de `frontend/` nem de `backend/` — o GitHub recebe a pasta vazia.

## Git

Na raiz do projeto (`C:\bikeger` ou equivalente):

```bash
git status
```

Se `frontend/` ou `backend/` aparecerem como outro repositório, apague o `.git` de dentro da pasta (não o da raiz) e adicione de novo.

O `.env` do backend **não** entra no git. O painel de produção usa `frontend/.env.production`, que **não é secret**: só a URL pública da API, que o Vite embute no JavaScript.

## Local

```bash
docker compose up -d
cd backend && npm install && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

API: `http://localhost:4000`  
App: `http://localhost:5174`

Copie `backend/.env.example` para `backend/.env`.

## Produção

- **Frontend (Vercel):** root `frontend`. O build lê `frontend/.env.production`.
- **API (Render):** root `backend`, `npm start`. Preencha `JWT_SECRET`, `FRONTEND_URL`, `API_PUBLIC_URL` e o Mongo em replica set.

`VITE_API_URL` precisa ser a URL pública da API (hoje `https://bikeger.onrender.com`). Sem isso o painel chama `/api` no domínio da Vercel e o login quebra. Modelo: `frontend/.env.production.example`.

O webhook do Mercado Pago usa `API_PUBLIC_URL`. Se apontar para localhost, o PIX não confirma.
