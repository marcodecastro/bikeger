import { useEffect, useState } from 'react';
import { get, put } from '../lib/api';
import type { Settings } from '../types';

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mpToken, setMpToken] = useState('');
  const [focusToken, setFocusToken] = useState('');
  const [cscToken, setCscToken] = useState('');
  const [waToken, setWaToken] = useState('');
  const [mechanicText, setMechanicText] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    get<Settings>('/settings')
      .then((loaded) => {
        setSettings(loaded);
        setMechanicText((loaded.mechanicNames || []).join('\n'));
      })
      .catch(() => undefined);
  }, []);

  if (!settings) return <section className="page">Carregando ajustes...</section>;

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    try {
      setError('');
      setStatus('');
      const saved = await put<Settings>('/settings', {
        ...settings,
        mechanicNames: mechanicText
          .split('\n')
          .map((name) => name.trim())
          .filter(Boolean),
        mpAccessToken: mpToken || undefined,
        focusNfeToken: focusToken || undefined,
        fiscalCscToken: cscToken || undefined,
        whatsappToken: waToken || undefined,
      });
      setSettings(saved);
      setMpToken('');
      setFocusToken('');
      setCscToken('');
      setWaToken('');
      setStatus(
        saved.fiscalReady
          ? 'Ajustes salvos. NFC-e pronta para homologação.'
          : 'Ajustes salvos. Ainda falta cadastro fiscal para emitir.',
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
          <p>Loja, Mercado Pago e NFC-e. O FOCUS_NFE_TOKEN fica aqui ou no .env do servidor.</p>
        </div>
      </div>
      <article className="card grid grid-2">
        <label className="field">
          Nome da loja
          <input value={settings.storeName} onChange={(event) => set('storeName', event.target.value)} />
        </label>
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
          Aviso de OS pronta (WhatsApp)
          <textarea
            value={
              settings.readyNoticeTemplate ||
              '{nome}, a {bike} da OS {os} está pronta para retirada na {loja}.'
            }
            onChange={(event) => set('readyNoticeTemplate', event.target.value)}
          />
        </label>
        <label className="field">
          Token WhatsApp Cloud
          <input
            value={waToken}
            placeholder={
              settings.hasWhatsAppCloud
                ? settings.whatsappFromEnv
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
            ? 'Aviso de OS pronta tenta a API oficial. Se falhar, o balcão ainda abre o wa.me.'
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
                ? settings.tokenFromEnv
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
            onChange={(event) => set('fiscalCscId', event.target.value)}
          />
        </label>
        <label className="field">
          CSC token
          <input
            value={cscToken}
            placeholder={settings.hasCsc ? 'CSC já configurado' : 'token da SEFAZ'}
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
            <option value="0">Não (só rascunho; emita na venda)</option>
            <option value="1">Sim (requer token + cadastro completo)</option>
          </select>
        </label>
        <div className="muted" style={{ gridColumn: '1 / -1' }}>
          {settings.fiscalReady ? (
            <p>Pronto para emitir na Focus ({settings.fiscalEnvironment}).</p>
          ) : (
            <p>
              Falta para emitir:{' '}
              {(settings.fiscalMissing || []).join(', ') || 'cadastro fiscal'}. O token da Focus
              também precisa estar cadastrado na empresa deles, com o CSC da SEFAZ.
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
