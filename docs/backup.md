# Backup e restore

O BikeGer grava um arquivo `.json.gz` (todas as collections) sem depender de `mongodump`. Vale no **Mongo local** e no **Atlas**. Dono gera, baixa e restaura em **Ajustes**.

A pasta `backend/backups` fica fora do git. No Render o disco some no deploy — baixe o arquivo.

## O que precisa

- Mongo acessível (`MONGODB_URI` no `backend/.env`)
- API no ar (para a tela) **ou** `npm run backup` / `npm run restore` na pasta `backend/`

## Backup na mão (CLI)

Na pasta `backend/`:

```bash
npm run backup
```

O arquivo vai para `backend/backups/bikeger-AAAA-MM-DDTHH-MM-SS.json.gz`.

Em desenvolvimento o fechamento do caixa **não** dispara backup, a menos que `BACKUP_ON_CLOSE=true`. Em produção o backup no fechamento já roda. Retenção: 14 dias.

| Variável | Para que serve |
|---|---|
| `BACKUP_DIR` | Pasta de destino (padrão: `backend/backups`) |
| `BACKUP_ON_CLOSE` | `true` para gravar dump também em desenvolvimento |
| `SKIP_BACKUP` | `true` para pular jobs automáticos (os testes já pulam) |
| `BACKUP_CLOUD_PUT_URL` | PUT HTTP do `.json.gz` (R2, S3 presigned, webhook). `{filename}` é substituído |
| `BACKUP_CLOUD_PUT_TOKEN` | `Authorization: Bearer` opcional nesse PUT |

## Restore

Pare a API. Na pasta `backend/`:

```bash
npm run restore -- backups/bikeger-AAAA-MM-DDTHH-MM-SS.json.gz RESTAURAR
```

O restore **substitui** as collections do banco da `MONGODB_URI` (menos `jobs` e `loginattempts`). Não rode isso no Atlas no automático.

Na tela de Ajustes o dono precisa digitar `RESTAURAR` para habilitar os botões.

Dumps antigos em pasta (`mongorestore`) ainda restauram pelo CLI se as Database Tools estiverem no PATH.

Depois suba a API de novo e confira o painel e um caixa fechado recente.
