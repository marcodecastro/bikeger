import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  refreshTransactionSupport,
  resetTransactionSupport,
  runInTransaction,
  transactionSupport,
} from '../src/utils/transaction.js';

test('standalone não abre sessão — work recebe null', async () => {
  resetTransactionSupport();
  await refreshTransactionSupport({
    command: async () => ({ isWritablePrimary: true }),
  });
  assert.equal(transactionSupport().transactions, false);

  const session = await runInTransaction(async (current) => current);
  assert.equal(session, null);
});

test('replica set marca transações ativas', async () => {
  resetTransactionSupport();
  const support = await refreshTransactionSupport({
    command: async () => ({ setName: 'rs0', isWritablePrimary: true }),
  });
  assert.equal(support.transactions, true);
  assert.equal(support.setName, 'rs0');
  resetTransactionSupport();
});
