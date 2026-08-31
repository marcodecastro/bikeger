import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../lib/api';
import { OS_STATUS } from '../lib/labels';
import { formatBRL } from '../lib/money';
import type { BikeHistory } from '../types';

export function BikeDetail() {
  const { id } = useParams();
  const [data, setData] = useState<BikeHistory | null>(null);

  useEffect(() => {
    if (!id) return;
    get<BikeHistory>(`/bikes/${id}`).then(setData).catch(() => undefined);
  }, [id]);

  if (!data) return <section className="page">Carregando bike...</section>;

  const owner = typeof data.bike.customer === 'object' ? data.bike.customer : null;

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
        <article className="card">
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
      </div>
    </section>
  );
}
