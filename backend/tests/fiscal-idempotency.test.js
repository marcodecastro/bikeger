import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { FiscalDocument } from '../src/models/FiscalDocument.js';
import { Sale } from '../src/models/Sale.js';
import { Settings } from '../src/models/Settings.js';
import '../src/models/Customer.js';
import { emitFiscalDocument, enqueueFiscalDocument } from '../src/services/fiscalService.js';

const uri = process.env.MONGODB_TEST_URI_A4 || 'mongodb://127.0.0.1:27017/bikeger_test_a4';

const EMITENTE = {
  storeName: 'BikeGer',
  storeCnpj: '12.345.678/0001-90',
  stateRegistration: '123456789',
  storeStreet: 'Rua da Oficina',
  storeNumber: '120',
  storeNeighborhood: 'Centro',
  storeCity: 'São Paulo',
  storeState: 'SP',
  storeZip: '01001-000',
  storePhone: '(11) 99999-0000',
  fiscalCscId: '000001',
  fiscalCscToken: 'ABCD1234',
  fiscalSeries: '1',
  fiscalEnvironment: 'homologacao',
  taxRegime: '1',
  fiscalEnabled: true,
  focusNfeToken: 'token-teste-a4',
};

before(async () => {
  await mongoose.connect(uri);
  await FiscalDocument.syncIndexes();
  await Promise.all([FiscalDocument.deleteMany({}), Sale.deleteMany({}), Settings.deleteMany({})]);
});

after(async () => {
  await mongoose.disconnect();
});

function oid() {
  return new mongoose.Types.ObjectId();
}

async function makeSale() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  return Sale.create({
    number: `VD-A4-${suffix}`,
    items: [
      {
        product: oid(),
        sku: 'COR-01',
        name: 'Corrente',
        quantity: 1,
        unitCost: 1000,
        unitPrice: 2000,
        total: 2000,
      },
    ],
    subtotal: 2000,
    discount: 0,
    total: 2000,
    payments: [{ method: 'pix', amount: 2000, status: 'aprovado' }],
    paidAmount: 2000,
    status: 'paga',
  });
}

test('índice único impede duas NFC-e abertas para a mesma venda', async () => {
  const relatedId = oid();
  await FiscalDocument.create({
    relatedType: 'sale',
    relatedId,
    status: 'pendente',
    amount: 1000,
  });
  await assert.rejects(
    () =>
      FiscalDocument.create({
        relatedType: 'sale',
        relatedId,
        status: 'pendente',
        amount: 1000,
      }),
    (error) => error.code === 11000,
  );
});

test('segundo enqueue da mesma venda devolve o rascunho existente', async () => {
  const sale = await makeSale();
  const first = await enqueueFiscalDocument({ relatedType: 'sale', relatedId: sale._id });
  const second = await enqueueFiscalDocument({ relatedType: 'sale', relatedId: sale._id });
  assert.equal(String(second._id), String(first._id));
  assert.equal(await FiscalDocument.countDocuments({ relatedType: 'sale', relatedId: sale._id }), 1);
});

test('dois enqueues em paralelo não criam NFC-e duplicada', async () => {
  const sale = await makeSale();
  const [a, b] = await Promise.all([
    enqueueFiscalDocument({ relatedType: 'sale', relatedId: sale._id }),
    enqueueFiscalDocument({ relatedType: 'sale', relatedId: sale._id }),
  ]);
  assert.equal(String(a._id), String(b._id));
  assert.equal(await FiscalDocument.countDocuments({ relatedType: 'sale', relatedId: sale._id }), 1);
});

test('NFC-e rejeitada libera a vaga para um novo rascunho', async () => {
  const sale = await makeSale();
  const first = await enqueueFiscalDocument({ relatedType: 'sale', relatedId: sale._id });
  first.status = 'rejeitada';
  await first.save();

  const second = await enqueueFiscalDocument({ relatedType: 'sale', relatedId: sale._id });
  assert.notEqual(String(second._id), String(first._id));
  assert.equal(second.status, 'pendente');
  assert.equal(await FiscalDocument.countDocuments({ relatedType: 'sale', relatedId: sale._id }), 2);
});

test('emit concorrente manda uma vez só à SEFAZ', async () => {
  const previous = process.env.FOCUS_NFE_TOKEN;
  process.env.FOCUS_NFE_TOKEN = 'token-teste-a4';
  await Settings.deleteMany({});
  await Settings.create(EMITENTE);

  const sale = await makeSale();
  const draft = await FiscalDocument.create({
    relatedType: 'sale',
    relatedId: sale._id,
    status: 'pendente',
    amount: sale.total,
  });

  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const sendToFocus = async () => {
    calls += 1;
    await gate;
    return { ok: true, status: 200, body: { status: 'autorizado', chave_nfe: 'NFe-A4', numero: '1' } };
  };

  try {
    const first = emitFiscalDocument(draft._id, { sendToFocus });

    let claimed = false;
    for (let i = 0; i < 40; i += 1) {
      const current = await FiscalDocument.findById(draft._id);
      if (current.status === 'processando') {
        claimed = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(claimed, true);

    const second = await emitFiscalDocument(draft._id, { sendToFocus });
    assert.equal(second.status, 'processando');
    assert.equal(calls, 1);

    release();
    const done = await first;
    assert.equal(done.status, 'autorizada');
    assert.equal(done.accessKey, 'NFe-A4');
    assert.equal(calls, 1);
  } finally {
    process.env.FOCUS_NFE_TOKEN = previous;
    await Settings.deleteMany({});
  }
});
