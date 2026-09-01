import mongoose from 'mongoose';

let topology = {
  checked: false,
  transactions: false,
  setName: '',
};

export function isTransactionUnsupported(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('Transaction numbers are only allowed') ||
    message.includes('replica set') ||
    (message.includes('Transaction') && message.includes('not supported'))
  );
}

export function transactionSupport() {
  return { ...topology };
}

export function resetTransactionSupport() {
  topology = { checked: false, transactions: false, setName: '' };
}

export async function refreshTransactionSupport(admin = mongoose.connection?.db?.admin()) {
  if (!admin) {
    topology = { checked: true, transactions: false, setName: '' };
    return transactionSupport();
  }

  try {
    const hello = await admin.command({ hello: 1 });
    const setName = hello.setName || '';
    topology = {
      checked: true,
      transactions: Boolean(setName) || hello.msg === 'isdbgrid',
      setName,
    };
  } catch {
    topology = { checked: true, transactions: false, setName: '' };
  }

  return transactionSupport();
}

/**
 * Roda o trabalho numa transação Mongo quando o servidor é replica set / mongos.
 * Em standalone, executa sem sessão — o caller ainda deve compensar exceções.
 */
export async function runInTransaction(work) {
  if (!topology.checked) await refreshTransactionSupport();

  if (!topology.transactions) {
    return work(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      topology.transactions = false;
      topology.setName = '';
      return work(null);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
