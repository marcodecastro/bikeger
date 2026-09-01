import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: 'BikeGer' },
    storePhone: { type: String, default: '' },
    storeAddress: { type: String, default: '' },
    storeCnpj: { type: String, default: '' },
    receiptFooter: {
      type: String,
      default: 'Obrigado pela preferência. Garantia de peças conforme fabricante.',
    },
    printerWidth: { type: Number, default: 80 },
    mpAccessToken: { type: String, default: '' },
    mpPublicKey: { type: String, default: '' },
    mechanicNames: { type: [String], default: ['Oficina'] },
    fiscalEnabled: { type: Boolean, default: false },
    stateRegistration: { type: String, default: '' },
    fiscalSeries: { type: String, default: '1' },
    fiscalEnvironment: { type: String, enum: ['homologacao', 'producao'], default: 'homologacao' },
    storeStreet: { type: String, default: '' },
    storeNumber: { type: String, default: '' },
    storeNeighborhood: { type: String, default: '' },
    storeCity: { type: String, default: '' },
    storeState: { type: String, default: 'SP' },
    storeZip: { type: String, default: '' },
    taxRegime: { type: String, default: '1' },
    focusNfeToken: { type: String, default: '' },
    fiscalCscId: { type: String, default: '' },
    fiscalCscToken: { type: String, default: '' },
    defaultNcm: { type: String, default: '87149990' },
    defaultCfop: { type: String, default: '5102' },
    defaultIcmsCst: { type: String, default: '102' },
    readyNoticeTemplate: {
      type: String,
      default: '{nome}, a {bike} da OS {os} está pronta para retirada na {loja}.',
    },
    whatsappToken: { type: String, default: '' },
    whatsappPhoneNumberId: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Settings = mongoose.model('Settings', settingsSchema);

export async function getSettings() {
  let doc = await Settings.findOne();
  if (!doc) {
    doc = await Settings.create({
      storeName: process.env.STORE_NAME || 'BikeGer',
      storePhone: process.env.STORE_PHONE || '',
      storeAddress: process.env.STORE_ADDRESS || '',
      storeCnpj: process.env.STORE_CNPJ || '',
    });
  }
  return doc;
}
