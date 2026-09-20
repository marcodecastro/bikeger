# Backup e restore

O BikeGer grava dump do Mongo no fechamento do caixa (em produção) e também por job `backup.daily`. A pasta `backend/backups` fica fora do git.

## O que precisa

- Mongo acessível (`MONGODB_URI` no `backend/.env`)
- `mongodump` e `mongorestore` no PATH ([Database Tools](https://www.mongodb.com/docs/database-tools/))

## Backup na mão

Na pasta `backend/`:

```bash
npm run backup
```

O dump vai para `backend/backups/bikeger-AAAA-MM-DDTHH-MM-SS/`.

Em desenvolvimento o fechamento do caixa **não** dispara backup, a menos que `BACKUP_ON_CLOSE=true`. Em produção o backup no fechamento já roda. Retenção: 14 dias.

Variáveis opcionais:

| Variável | Para que serve |
|---|---|
| `BACKUP_DIR` | Pasta de destino (padrão: `backend/backups`) |
| `BACKUP_ON_CLOSE` | `true` para gravar dump também em desenvolvimento |
| `SKIP_BACKUP` | `true` para pular (os testes já pulam) |

## Restore de teste

Pare a API. Na pasta `backend/`:

```bash
npm run restore -- backups/bikeger-AAAA-MM-DDTHH-MM-SS
```

O restore usa `--drop`: substitui as collections do banco da `MONGODB_URI`. Não rode isso em produção no automático — é para recuperar um dia específico num ambiente de teste.

Depois suba a API de novo e confira o painel e um caixa fechado recente.
