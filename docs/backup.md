# Backup e restore do BikeGer

O kardex, o caixa e as OS moram no Mongo. JWT e webhook bonitos não recompõem o estoque.

## Dump diário

No horário de fechamento o servidor enfileira `backup.daily` (só em `NODE_ENV=production`, ou com `BACKUP_ON_CLOSE=true` no .env). Também dá para rodar na mão:

```bash
cd backend
npm run backup
```

Isso chama `mongodump` na `MONGODB_URI` e grava em `backend/backups/bikeger-AAAA-MM-DDTHH-MM-SS/` (a pasta está no `.gitignore`).

Retenção: 14 dias. Pastas mais velhas são apagadas no dump seguinte.

Instale as [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) para ter `mongodump` e `mongorestore` no PATH.

Agende no Windows (Agendador de Tarefas) ou no Linux (`cron`) um `npm run backup` depois do expediente, por volta das 19h — mesmo se o fechamento do caixa falhar naquele dia.

## Restore de teste (uma vez por mês)

1. Suba um Mongo **vazio** (outra URI, outro container). Não aponte para o banco da loja.
2. Restore:

```bash
cd backend
npm run restore -- backups/bikeger-AAAA-MM-DDTHH-MM-SS
```

O `mongorestore --drop` substitui as coleções da URI atual. Use uma URI de teste.

3. Abra o painel nessa API e confira: um caixa fechado recente, uma OS e o estoque de um SKU conhecido.

Se o restore de teste passar, o dump do mês serve. Se falhar, o backup não vale — corrija o agendamento antes de precisar dele de verdade.
