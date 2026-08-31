import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { BIKE_TYPES } from '../lib/labels';
import type { Bike } from '../types';

export function Bikes() {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    get<Bike[]>(`/bikes${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then(setBikes)
      .catch(() => undefined);
  }, [q]);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>Bicicletas</h2>
          <p>Cada bike tem dono, série e um histórico de peças trocadas na oficina.</p>
        </div>
      </div>
      <label className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
        Buscar
        <input value={q} onChange={(event) => setQ(event.target.value)} />
      </label>
      <article className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Bike</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Série</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bikes.map((bike) => (
              <tr key={bike._id}>
                <td>
                  {bike.brand} {bike.model}
                </td>
                <td>{typeof bike.customer === 'object' ? bike.customer.name : ''}</td>
                <td>{BIKE_TYPES[bike.type] || bike.type}</td>
                <td>{bike.serialNumber}</td>
                <td>
                  <Link to={`/bikes/${bike._id}`}>Histórico</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  );
}
