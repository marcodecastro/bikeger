import { useEffect, useState } from 'react';
import { get, put } from '../lib/api';
import type { Settings } from '../types';

function previewNotice(template: string, storeName: string) {
  return template
    .replaceAll('{nome}', 'Maria')
    .replaceAll('{bike}', 'Caloi Elite')
    .replaceAll('{os}', 'OS-00042')
    .replaceAll('{loja}', storeName || 'BikeGer')
    .replaceAll('{valor}', 'R$ 249,80');
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mpToken, setMpToken] = useState('');
  const [focusToken, setFocusToken] = useState('');
  const [cscToken, setCscToken] = useState('');
  const [waToken, setWaToken] = useState('');
  const [mechanicText, setMechanicText] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);

  const MAX_LOGO_BYTES = 250 * 1024;

  useEffect(() => {
    get<Settings>('/settings')
      .then((loaded) => {
        setLoadError('');
        setSettings(loaded);
        setMechanicText((loaded.mechanicNames || []).join('\n'));
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Falha ao carregar os ajustes');
      });
  }, []);

  if (!settings && loadError) {
    return (
      <section className="page">
        <p className="error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }

  if (!settings) return <section className="page">Carregando ajustes...</section>;

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setError('Use PNG, JPEG ou WebP.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('Logo até 250 KB.');
      return;
    }
    setLogoBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      set('storeLogo', dataUrl);
      setError('');
    } catch {
      setError('Não foi possível ler a imagem.');
    } finally {
      setLogoBusy(false);
    }
  }

  async function save() {
    try {
      setError('');
      setStatus('');
      const payload = {
        ...settings,
        mechanicNames: mechanicText
          .split('\n')
          .map((name) => name.trim())
          .filter(Boolean),
        mpAccessToken: mpToken || undefined,
        focusNfeToken: focusToken || undefined,
        fiscalCscToken: cscToken || undefined,
        whatsappToken: waToken || undefined,
      };
      if (settings.secretsFromEnv) {
        delete payload.mpAccessToken;
        delete payload.focusNfeToken;
        delete payload.fiscalCscToken;
        delete payload.fiscalCscId;
        delete payload.whatsappToken;
      }
      const saved = await put<Settings>('/settings', payload);
      setSettings(saved);
      setMpToken('');
      setFocusToken('');
      setCscToken('');
      setWaToken('');
      setStatus(
        saved.fiscalEnabled
          ? saved.fiscalReady
            ? 'Ajustes salvos. NFC-e pronta para homologação.'
            : 'Ajustes salvos. Ainda falta cadastro fiscal para emitir.'
          : 'Ajustes salvos. NFC-e desligada — a loja opera com cupom térmico.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar ajustes');
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Ajustes</h2>
          <p>Loja, Mercado Pago e NFC-e. Em produção os tokens (MP, Focus, WhatsApp, CSC) ficam só no .env.</p>
        </div>
      </div>
      <article className="card grid grid-2">
        <label className="field">
          Nome da loja
          <input value={settings.storeName} onChange={(event) => set('storeName', event.target.value)} />
        </label>
        <label className="field">
          Logo da loja
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={logoBusy}
            onChange={(event) => void onLogoFile(event.target.files?.[0] || null)}
          />
        </label>
        {settings.storeLogo ? (
          <div className="logo-preview" style={{ gridColumn: '1 / -1' }}>
            <img src={settings.storeLogo} alt="Logo da loja" />
            <button type="button" className="btn" onClick={() => set('storeLogo', '')}>
              Remover logo
            </button>
          </div>
        ) : (
          <p className="muted" style={{ gridColumn: '1 / -1' }}>
            PNG, JPEG ou WebP até 250 KB. Aparece no login, no menu e na impressão do navegador.
          </p>
        )}
        <label className="field">
          Telefone
          <input value={settings.storePhone} onChange={(event) => set('storePhone', event.target.value)} />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Endereço (cupom térmico)
          <input value={settings.storeAddress} onChange={(event) => set('storeAddress', event.target.value)} />
        </label>
        <label className="field">
          CNPJ
          <input value={settings.storeCnpj} onChange={(event) => set('storeCnpj', event.target.value)} />
        </label>
        <label className="field">
          Largura da impressora
          <select
            value={String(settings.printerWidth)}
            onChange={(event) => set('printerWidth', Number(event.target.value))}
          >
            <option value="80">80 mm</option>
            <option value="58">58 mm</option>
          </select>
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Nomes dos mecânicos (um por linha)
          <textarea
            value={mechanicText}
            onChange={(event) => setMechanicText(event.target.value)}
            placeholder="Oficina"
          />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Aviso de OS aberta (WhatsApp)
          <textarea
            value={
              settings.openedNoticeTemplate ||
              '{nome}, a {bike} entrou na oficina ({os}) na {loja}.'
            }
            onChange={(event) => set('openedNoticeTemplate', event.target.value)}
          />
          <span className="muted">
            Preview:{' '}
            {previewNotice(
              settings.openedNoticeTemplate ||
                '{nome}, a {bike} entrou na oficina ({os}) na {loja}.',
              settings.storeName,
            )}
          </span>
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Aviso de OS pronta (WhatsApp)
          <textarea
            value={
              settings.readyNoticeTemplate ||
              '{nome}, a {bike} da OS {os} está pronta para retirada na {loja}.'
            }
            onChange={(event) => set('readyNoticeTemplate', event.target.value)}
          />
          <span className="muted">
            Preview:{' '}
            {previewNotice(
              settings.readyNoticeTemplate ||
                '{nome}, a {bike} da OS {os} está pronta para retirada na {loja}.',
              settings.storeName,
            )}
          </span>
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Aviso de OS paga / pode retirar
          <textarea
            value={
              settings.paidNoticeTemplate ||
              '{nome}, a {bike} da OS {os} já está paga e pode retirar na {loja}.'
            }
            onChange={(event) => set('paidNoticeTemplate', event.target.value)}
          />
          <span className="muted">
            Preview:{' '}
            {previewNotice(
              settings.paidNoticeTemplate ||
                '{nome}, a {bike} da OS {os} já está paga e pode retirar na {loja}.',
              settings.storeName,
            )}
          </span>
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Aviso de orçamento (WhatsApp)
          <textarea
            value={
              settings.quoteNoticeTemplate ||
              '{nome}, o orçamento da {bike} na OS {os} ficou em {valor}. Pode fazer? {loja}'
            }
            onChange={(event) => set('quoteNoticeTemplate', event.target.value)}
          />
          <span className="muted">
            Preview:{' '}
            {previewNotice(
              settings.quoteNoticeTemplate ||
                '{nome}, o orçamento da {bike} na OS {os} ficou em {valor}. Pode fazer? {loja}',
              settings.storeName,
            )}
          </span>
        </label>
        <label className="field">
          OS parada em aguardando peças (dias)
          <input
            type="number"
            min={1}
            max={30}
            value={settings.waitingPartsDays || 3}
            onChange={(event) => set('waitingPartsDays', Number(event.target.value))}
          />
        </label>
        <label className="field">
          Token WhatsApp Cloud
          <input
            value={waToken}
            placeholder={
              settings.hasWhatsAppCloud
                ? settings.whatsappFromEnv || settings.secretsFromEnv
                  ? 'Token já definido no .env'
                  : 'Token já salvo nos ajustes'
                : 'WHATSAPP_TOKEN da Meta'
            }
            onChange={(event) => setWaToken(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          Phone number ID
          <input
            value={settings.whatsappPhoneNumberId || ''}
            placeholder="ID do número na Meta"
            onChange={(event) => set('whatsappPhoneNumberId', event.target.value)}
          />
        </label>
        <p className="muted" style={{ gridColumn: '1 / -1' }}>
          {settings.hasWhatsAppCloud
            ? 'Aviso tenta a API oficial. Se falhar, o balcão ainda abre o wa.me. Quatro eventos: oficina, orçamento, pronta e paga. Sem campanha de marketing.'
            : 'Sem token da Cloud, o aviso continua pelo wa.me (o atendente envia na hora).'}
        </p>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Rodapé do cupom
          <textarea
            value={settings.receiptFooter}
            onChange={(event) => set('receiptFooter', event.target.value)}
          />
        </label>
        <label className="field">
          Access Token Mercado Pago
          <input
            value={mpToken}
            placeholder={settings.hasMpToken ? 'Token já configurado' : 'APP_USR-...'}
            onChange={(event) => setMpToken(event.target.value)}
          />
        </label>
        <label className="field">
          Public Key
          <input
            value={settings.mpPublicKey || ''}
            onChange={(event) => set('mpPublicKey', event.target.value)}
          />
        </label>

        <h3 style={{ gridColumn: '1 / -1', margin: '8px 0 0' }}>NFC-e / Focus NFe</h3>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          FOCUS_NFE_TOKEN
          <input
            value={focusToken}
            placeholder={
              settings.hasFocusNfe
                ? settings.tokenFromEnv || settings.secretsFromEnv
                  ? 'Token já definido no .env do servidor'
                  : 'Token já salvo nos ajustes'
                : 'token da API Focus (homologação ou produção)'
            }
            onChange={(event) => setFocusToken(event.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          Logradouro (SEFAZ)
          <input
            value={settings.storeStreet || ''}
            onChange={(event) => set('storeStreet', event.target.value)}
          />
        </label>
        <label className="field">
          Número
          <input
            value={settings.storeNumber || ''}
            onChange={(event) => set('storeNumber', event.target.value)}
          />
        </label>
        <label className="field">
          Bairro
          <input
            value={settings.storeNeighborhood || ''}
            onChange={(event) => set('storeNeighborhood', event.target.value)}
          />
        </label>
        <label className="field">
          Município
          <input
            value={settings.storeCity || ''}
            onChange={(event) => set('storeCity', event.target.value)}
          />
        </label>
        <label className="field">
          UF
          <input
            maxLength={2}
            value={settings.storeState || ''}
            onChange={(event) => set('storeState', event.target.value.toUpperCase())}
          />
        </label>
        <label className="field">
          CEP
          <input
            value={settings.storeZip || ''}
            onChange={(event) => set('storeZip', event.target.value)}
          />
        </label>
        <label className="field">
          Inscrição estadual
          <input
            value={settings.stateRegistration || ''}
            onChange={(event) => set('stateRegistration', event.target.value)}
          />
        </label>
        <label className="field">
          CSC ID
          <input
            value={settings.fiscalCscId || ''}
            disabled={Boolean(settings.secretsFromEnv)}
            placeholder={
              settings.secretsFromEnv ? 'FISCAL_CSC_ID no .env do servidor' : 'identificador do CSC'
            }
            onChange={(event) => set('fiscalCscId', event.target.value)}
          />
        </label>
        <label className="field">
          CSC token
          <input
            value={cscToken}
            disabled={Boolean(settings.secretsFromEnv)}
            placeholder={
              settings.secretsFromEnv
                ? 'FISCAL_CSC_TOKEN no .env do servidor'
                : settings.hasCsc
                  ? 'CSC já configurado'
                  : 'token da SEFAZ'
            }
            onChange={(event) => setCscToken(event.target.value)}
          />
        </label>
        <label className="field">
          NCM padrão
          <input
            value={settings.defaultNcm || '87149990'}
            onChange={(event) => set('defaultNcm', event.target.value)}
          />
        </label>
        <label className="field">
          CFOP padrão
          <input
            value={settings.defaultCfop || '5102'}
            onChange={(event) => set('defaultCfop', event.target.value)}
          />
        </label>
        <label className="field">
          Série NFC-e
          <input
            value={settings.fiscalSeries || '1'}
            onChange={(event) => set('fiscalSeries', event.target.value)}
          />
        </label>
        <label className="field">
          Ambiente fiscal
          <select
            value={settings.fiscalEnvironment || 'homologacao'}
            onChange={(event) =>
              set('fiscalEnvironment', event.target.value as 'homologacao' | 'producao')
            }
          >
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </label>
        <label className="field">
          Emitir NFC-e após venda paga
          <select
            value={settings.fiscalEnabled ? '1' : '0'}
            onChange={(event) => set('fiscalEnabled', event.target.value === '1')}
          >
            <option value="0">Não usar NFC-e (só cupom térmico)</option>
            <option value="1">Sim (requer token Focus + cadastro completo)</option>
          </select>
        </label>
        <div className="muted" style={{ gridColumn: '1 / -1' }}>
          {settings.fiscalEnabled ? (
            settings.fiscalReady ? (
              <p>Pronto para emitir na Focus ({settings.fiscalEnvironment}). O sistema consulta até autorizar ou rejeitar.</p>
            ) : (
              <p>
                Falta para emitir:{' '}
                {(settings.fiscalMissing || []).join(', ') || 'cadastro fiscal'}. O token da Focus
                também precisa estar cadastrado na empresa deles, com o CSC da SEFAZ.
              </p>
            )
          ) : (
            <p>
              NFC-e é opcional. Com esta opção desligada o PDV não espera a SEFAZ e o rascunho
              fiscal não vira obrigação. Liga só quando a loja for emitir de verdade.
            </p>
          )}
        </div>
        {error ? <p className="error" style={{ gridColumn: '1 / -1' }}>{error}</p> : null}
        {status ? <p className="muted" style={{ gridColumn: '1 / -1' }}>{status}</p> : null}
        <button type="button" className="btn btn-primary" onClick={() => void save()}>
          Salvar ajustes
        </button>
      </article>
    </section>
  );
}
