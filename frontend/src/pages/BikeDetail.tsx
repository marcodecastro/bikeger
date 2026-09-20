import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, put } from '../lib/api';
import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { BikeHistory } from '../types';
import { BikeFields } from '../components/BikeFields';

export function BikeDetail() {
  const { id } = useParams();
  const [data, setData] = useState<BikeHistory | null>(null);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState('mtb');
  const [serialNumber, setSerialNumber] = useState('');
  const [color, setColor] = useState('');
  const [frameSize, setFrameSize] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    get<BikeHistory>(`/bikes/${id}`)
      .then((loaded) => {
        setData(loaded);
        setBrand(loaded.bike.brand || '');
        setModel(loaded.bike.model || '');
        setType(loaded.bike.type || 'mtb');
        setSerialNumber(loaded.bike.serialNumber || '');
        setColor(loaded.bike.color || '');
        setFrameSize(loaded.bike.frameSize || '');
      })
      .catch(() => undefined);
  }, [id]);

  if (!data) return <section className="page">Carregando bike...</section>;

  const owner = typeof data.bike.customer === 'object' ? data.bike.customer : null;

  async function saveBike() {
    if (!id) return;
    try {
      setError('');
      setStatus('');
      setSaving(true);
      if (!brand.trim() || !model.trim()) {
        setError('Informe marca e modelo.');
        return;
      }
      const saved = await put<BikeHistory['bike']>(`/bikes/${id}`, {
        brand: brand.trim(),
        model: model.trim(),
        type,
        serialNumber: serialNumber.trim(),
        color: color.trim(),
        frameSize: frameSize.trim(),
      });
      setData((current) => (current ? { ...current, bike: { ...current.bike, ...saved } } : current));
      setStatus('Ficha da bike atualizada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a bike');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>
            {data.bike.brand} {data.bike.model}
          </h2>
          <p>
            {owner ? <Link to={`/clientes/${owner._id}`}>{owner.name}</Link> : null}
            {data.bike.serialNumber ? ` · série ${data.bike.serialNumber}` : ''}
          </p>
        </div>
        <span className="badge">{data.openOrders} OS abertas</span>
      </div>

      <div className="grid grid-2">
        <article className="card">
          <h3>Ficha da bike</h3>
          <div className="grid grid-2">
            <BikeFields
              brand={brand}
              model={model}
              type={type}
              serialNumber={serialNumber}
              color={color}
              frameSize={frameSize}
              onBrand={setBrand}
              onModel={setModel}
              onType={setType}
              onSerialNumber={setSerialNumber}
              onColor={setColor}
              onFrameSize={setFrameSize}
            />
          </div>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {status ? <p className="muted">{status}</p> : null}
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void saveBike()}>
            Salvar ficha
          </button>
        </article>
        <article className="card">
          <h3>Linha do tempo</h3>
          <div className="timeline">
            {data.timeline.map((item) => (
              <div className="tl-item" key={item.id}>
                <Link to={`/oficina/${item.id}`}>
                  <strong>{item.number}</strong>
                </Link>
                <div className="muted">
                  {new Date(item.date).toLocaleDateString('pt-BR')} · {OS_STATUS[item.status]}
                </div>
                {item.complaint ? <p>{item.complaint}</p> : null}
                {item.services.length ? <p className="muted">{item.services.join(', ')}</p> : null}
                {item.parts.length ? <p>{item.parts.join(', ')}</p> : null}
                <span className="money">{formatBRL(item.total)}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card table-wrap" style={{ marginTop: 16 }}>
        <h3>Peças já trocadas</h3>
        <table>
          <tbody>
            {data.partsReplaced.map((part, index) => (
              <tr key={`${part.sku}-${index}`}>
                <td>
                  {part.quantity}x {part.name}
                  <div className="muted">{part.workOrder}</div>
                </td>
                <td className="money">{formatBRL(part.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
