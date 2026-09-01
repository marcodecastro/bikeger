import 'dotenv/config';
import { connectDb, disconnectDb } from '../src/config/db.js';
import { Supplier } from '../src/models/Supplier.js';
import { Product } from '../src/models/Product.js';
import { Customer } from '../src/models/Customer.js';
import { Bike } from '../src/models/Bike.js';
import { Service } from '../src/models/Service.js';
import { Sale } from '../src/models/Sale.js';
import { WorkOrder } from '../src/models/WorkOrder.js';
import { StockMovement } from '../src/models/StockMovement.js';
import { CashRegister } from '../src/models/CashRegister.js';
import { Settings, getSettings } from '../src/models/Settings.js';
import { Counter } from '../src/models/Counter.js';
import { createSale } from '../src/services/saleService.js';
import { addPartToWorkOrder, addServiceToWorkOrder, createWorkOrder } from '../src/services/workOrderService.js';
import { openRegister } from '../src/services/cashService.js';
import { User } from '../src/models/User.js';
import { ensureDefaultUsers } from '../src/services/userService.js';
import { assertSeedAllowed } from '../src/utils/security.js';

async function seed() {
  assertSeedAllowed();
  await connectDb();

  await Promise.all([
    Product.deleteMany({}),
    Supplier.deleteMany({}),
    Customer.deleteMany({}),
    Bike.deleteMany({}),
    Service.deleteMany({}),
    Sale.deleteMany({}),
    WorkOrder.deleteMany({}),
    StockMovement.deleteMany({}),
    CashRegister.deleteMany({}),
    Settings.deleteMany({}),
    Counter.deleteMany({}),
    User.deleteMany({}),
  ]);

  await getSettings();
  await ensureDefaultUsers();

  const [shimano, pirelli, mucoff, local] = await Supplier.create([
    { name: 'Shimano Brasil', tradeName: 'Shimano', city: 'São Paulo', phone: '(11) 4000-1000' },
    { name: 'Pirelli Ciclismo', tradeName: 'Pirelli', city: 'Campinas', phone: '(19) 4000-2000' },
    { name: 'Muc-Off Dist.', tradeName: 'Muc-Off', city: 'Curitiba', phone: '(41) 4000-3000' },
    { name: 'Distribuidora Pedal', tradeName: 'Pedal Atacado', city: 'São Paulo', phone: '(11) 3333-4444' },
  ]);

  const products = await Product.create([
    {
      sku: 'COR-HG53',
      barcode: '7891000000011',
      name: 'Corrente Shimano HG53 9v',
      description: 'Corrente 9 velocidades para MTB e speed.',
      category: 'Transmissão',
      brand: 'Shimano',
      model: 'HG53',
      unit: 'UN',
      costPrice: 4500,
      salePrice: 7990,
      currentStock: 12,
      minStock: 4,
      location: 'A-12',
      supplier: shimano._id,
      images: [],
    },
    {
      sku: 'PAS-DEORE',
      barcode: '7891000000028',
      name: 'Pastilha freio Shimano Deore',
      description: 'Par de pastilhas resina para freio hidráulico.',
      category: 'Freios',
      brand: 'Shimano',
      model: 'B01S',
      unit: 'PAR',
      costPrice: 2800,
      salePrice: 4990,
      currentStock: 8,
      minStock: 4,
      location: 'B-03',
      supplier: shimano._id,
    },
    {
      sku: 'PNE-SC29',
      barcode: '7891000000035',
      name: 'Pneu Pirelli Scorpion 29x2.20',
      description: 'Pneu MTB misto, carcaça 60 TPI.',
      category: 'Pneus',
      brand: 'Pirelli',
      model: 'Scorpion XC',
      unit: 'UN',
      costPrice: 8900,
      salePrice: 14990,
      currentStock: 6,
      minStock: 2,
      location: 'C-01',
      supplier: pirelli._id,
    },
    {
      sku: 'CAM-29S',
      barcode: '7891000000042',
      name: 'Câmara 29 Schrader',
      description: 'Câmara butílica válvula grossa.',
      category: 'Pneus',
      brand: 'Kenda',
      model: '29x1.90-2.30',
      unit: 'UN',
      costPrice: 1200,
      salePrice: 2490,
      currentStock: 24,
      minStock: 10,
      location: 'C-08',
      supplier: local._id,
    },
    {
      sku: 'OLE-MUC',
      barcode: '7891000000059',
      name: 'Óleo de corrente Muc-Off Dry',
      description: 'Lubrificante para clima seco, 50ml.',
      category: 'Lubrificantes',
      brand: 'Muc-Off',
      model: 'Dry Lube',
      unit: 'UN',
      costPrice: 3500,
      salePrice: 6990,
      currentStock: 15,
      minStock: 5,
      location: 'D-02',
      supplier: mucoff._id,
    },
    {
      sku: 'CAB-CAMB',
      barcode: '7891000000066',
      name: 'Cabo de câmbio inox',
      description: 'Cabo inox 2.000 mm com ponta polida.',
      category: 'Transmissão',
      brand: 'Jagwire',
      model: 'Sport',
      unit: 'UN',
      costPrice: 800,
      salePrice: 1990,
      currentStock: 40,
      minStock: 12,
      location: 'A-02',
      supplier: local._id,
    },
    {
      sku: 'CAS-1136',
      barcode: '7891000000073',
      name: 'Cassete Shimano 11-36 10v',
      description: 'Cassete Deore 10 velocidades.',
      category: 'Transmissão',
      brand: 'Shimano',
      model: 'CS-HG50',
      unit: 'UN',
      costPrice: 18000,
      salePrice: 28990,
      currentStock: 3,
      minStock: 2,
      location: 'A-20',
      supplier: shimano._id,
    },
    {
      sku: 'PED-HT2',
      barcode: '7891000000080',
      name: 'Pedivela Hollowtech 175mm',
      description: 'Pedivela 2x10 com movimento incluso.',
      category: 'Pedivela',
      brand: 'Shimano',
      model: 'FC-M610',
      unit: 'UN',
      costPrice: 32000,
      salePrice: 49990,
      currentStock: 2,
      minStock: 1,
      location: 'A-30',
      supplier: shimano._id,
    },
    {
      sku: 'GUI-780',
      barcode: '7891000000097',
      name: 'Guidão MTB 780mm',
      description: 'Alumínio 31.8 mm, rise 20 mm.',
      category: 'Guidão',
      brand: 'Race Face',
      model: 'Chester',
      unit: 'UN',
      costPrice: 6500,
      salePrice: 11990,
      currentStock: 5,
      minStock: 2,
      location: 'E-04',
      supplier: local._id,
    },
    {
      sku: 'SEL-ROYAL',
      barcode: '7891000000103',
      name: 'Selim Selle Royal Lookin',
      description: 'Selim urbano com gel.',
      category: 'Selim',
      brand: 'Selle Royal',
      model: 'Lookin Moderate',
      unit: 'UN',
      costPrice: 9800,
      salePrice: 16990,
      currentStock: 4,
      minStock: 2,
      location: 'E-11',
      supplier: local._id,
    },
    {
      sku: 'CAP-GIRO',
      barcode: '7891000000110',
      name: 'Capacete Giro Fixture',
      description: 'Capacete MTB com viseira.',
      category: 'Segurança',
      brand: 'Giro',
      model: 'Fixture MIPS',
      unit: 'UN',
      costPrice: 22000,
      salePrice: 34990,
      currentStock: 7,
      minStock: 3,
      location: 'F-01',
      supplier: local._id,
    },
    {
      sku: 'KIT-KMC',
      barcode: '7891000000127',
      name: 'Kit relação KMC 9v',
      description: 'Corrente + cassete 11-32.',
      category: 'Transmissão',
      brand: 'KMC',
      model: 'Z9 Kit',
      unit: 'KIT',
      costPrice: 5500,
      salePrice: 9990,
      currentStock: 1,
      minStock: 2,
      location: 'A-18',
      supplier: local._id,
    },
    {
      sku: 'DIS-180',
      barcode: '7891000000134',
      name: 'Disco de freio 180mm',
      description: 'Rotor 6 furos, aço inox.',
      category: 'Freios',
      brand: 'Shimano',
      model: 'SM-RT56',
      unit: 'UN',
      costPrice: 4200,
      salePrice: 7490,
      currentStock: 10,
      minStock: 3,
      location: 'B-10',
      supplier: shimano._id,
    },
    {
      sku: 'MOV-CENT',
      barcode: '7891000000141',
      name: 'Movimento central Hollowtech II',
      description: 'BSA 68/73 mm.',
      category: 'Pedivela',
      brand: 'Shimano',
      model: 'BB-MT500',
      unit: 'UN',
      costPrice: 8900,
      salePrice: 14990,
      currentStock: 4,
      minStock: 2,
      location: 'A-28',
      supplier: shimano._id,
    },
    {
      sku: 'FIT-GUI',
      barcode: '7891000000158',
      name: 'Fita de guidão speed',
      description: 'Fita EVA com rolha e adesivo.',
      category: 'Acessórios',
      brand: 'Velox',
      model: 'Max Comfort',
      unit: 'PAR',
      costPrice: 2500,
      salePrice: 4990,
      currentStock: 18,
      minStock: 6,
      location: 'E-20',
      supplier: local._id,
    },
  ]);

  const bySku = Object.fromEntries(products.map((product) => [product.sku, product]));

  const services = await Service.create([
    { name: 'Revisão completa', description: 'Check-up de 30 pontos, limpeza e regulagens.', category: 'Revisão', price: 18900, estimatedMinutes: 90 },
    { name: 'Troca de pneu', description: 'Remoção, montagem e calibragem.', category: 'Rodas', price: 3500, estimatedMinutes: 20 },
    { name: 'Centragem de roda', description: 'Centragem lateral e radial.', category: 'Rodas', price: 6000, estimatedMinutes: 40 },
    { name: 'Sangria de freio hidráulico', description: 'Troca de fluido e sangria completa.', category: 'Freios', price: 8000, estimatedMinutes: 45 },
    { name: 'Regulagem de câmbio', description: 'Limitadores, cabo e indexing.', category: 'Transmissão', price: 4500, estimatedMinutes: 30 },
    { name: 'Montagem de bike', description: 'Montagem a partir do quadro ou caixa.', category: 'Montagem', price: 25000, estimatedMinutes: 120 },
    { name: 'Limpeza e lubrificação', description: 'Lavagem, secagem e lube da transmissão.', category: 'Manutenção', price: 7000, estimatedMinutes: 40 },
  ]);

  const [ana, bruno, clara] = await Customer.create([
    {
      name: 'Ana Ribeiro',
      phone: '(11) 98888-1100',
      email: 'ana.ribeiro@email.com',
      document: '123.456.789-00',
      address: { city: 'São Paulo', state: 'SP', neighborhood: 'Pinheiros' },
    },
    {
      name: 'Bruno Costa',
      phone: '(11) 97777-2200',
      email: 'bruno.costa@email.com',
      document: '987.654.321-00',
      address: { city: 'São Paulo', state: 'SP', neighborhood: 'Vila Madalena' },
    },
    {
      name: 'Clara Mendes',
      phone: '(11) 96666-3300',
      email: 'clara.mendes@email.com',
      document: '111.222.333-44',
      address: { city: 'Guarulhos', state: 'SP', neighborhood: 'Centro' },
    },
  ]);

  const [scott, specialized, caloi] = await Bike.create([
    {
      customer: ana._id,
      brand: 'Scott',
      model: 'Scale 970',
      year: 2022,
      color: 'Preta/amarela',
      serialNumber: 'SCT970-221144',
      frameSize: 'M',
      type: 'mtb',
    },
    {
      customer: bruno._id,
      brand: 'Specialized',
      model: 'Allez Sport',
      year: 2021,
      color: 'Azul',
      serialNumber: 'SPC-ALZ-8891',
      frameSize: '54',
      type: 'speed',
    },
    {
      customer: clara._id,
      brand: 'Caloi',
      model: 'Elite Carbon',
      year: 2020,
      color: 'Vermelha',
      serialNumber: 'CAL-ELC-4402',
      frameSize: '17',
      type: 'mtb',
    },
  ]);

  await openRegister({ openingAmount: 25000, operator: 'Marco' });

  await createSale({
    customer: ana._id,
    items: [
      { product: bySku['OLE-MUC']._id, quantity: 1 },
      { product: bySku['CAM-29S']._id, quantity: 2 },
    ],
    payments: [{ method: 'pix', amount: 11970 }],
    operator: 'Marco',
  });

  await createSale({
    customer: bruno._id,
    items: [{ product: bySku['CAP-GIRO']._id, quantity: 1 }],
    payments: [{ method: 'cartao_credito', amount: 34990 }],
    operator: 'Marco',
  });

  const os1 = await createWorkOrder({
    customer: ana._id,
    bike: scott._id,
    complaint: 'Câmbio fazendo barulho e pneu traseiro careca.',
    diagnosis: 'Cabo alongado e pneu no limite. Trocar pneu e regular transmissão.',
    mechanic: 'Léo',
    status: 'em_servico',
  });

  await addServiceToWorkOrder(os1._id, { serviceId: services[4]._id, quantity: 1 });
  await addServiceToWorkOrder(os1._id, { serviceId: services[1]._id, quantity: 1 });
  await addPartToWorkOrder(os1._id, { productId: bySku['PNE-SC29']._id, quantity: 1 });
  await addPartToWorkOrder(os1._id, { productId: bySku['CAB-CAMB']._id, quantity: 1 });

  const os2 = await createWorkOrder({
    customer: bruno._id,
    bike: specialized._id,
    complaint: 'Freio dianteiro esponjoso.',
    diagnosis: 'Necessita sangria. Disco ok.',
    mechanic: 'Léo',
    status: 'diagnostico',
  });
  await addServiceToWorkOrder(os2._id, { serviceId: services[3]._id, quantity: 1 });

  const os3 = await createWorkOrder({
    customer: clara._id,
    bike: caloi._id,
    complaint: 'Revisão antes da trilha de domingo.',
    mechanic: 'Rafa',
    status: 'aberta',
  });
  await addServiceToWorkOrder(os3._id, { serviceId: services[0]._id, quantity: 1 });

  console.log('Seed BikeGer concluído.');
  console.log('Produtos:', products.length);
  console.log('Clientes:', 3);
  console.log('OS abertas: 3');
  await disconnectDb();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
