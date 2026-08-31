import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { get, post, put } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CATEGORIES, UNITS } from '../lib/labels';
import type { Product, Supplier } from '../types';
import { MoneyInput } from '../components/MoneyInput';

interface FormState {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  model: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  currentStock: number;
  minStock: number;
  location: string;
  supplier: string;
  active: boolean;
  images: string;
  ncm: string;
  cfop: string;
}

const empty: FormState = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category: 'Transmissão',
  brand: '',
  model: '',
  unit: 'UN',
  costPrice: 0,
  salePrice: 0,
  currentStock: 0,
  minStock: 0,
  location: '',
  supplier: '',
  active: true,
  images: '',
  ncm: '87149990',
  cfop: '5102',
};

export function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can('products.write');
  const [form, setForm] = useState<FormState>(empty);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState('');
  const isNew = !id || id === 'novo';

  useEffect(() => {
    if (isNew && !canEdit) navigate('/produtos');
  }, [isNew, canEdit, navigate]);

  useEffect(() => {
    get<Supplier[]>('/suppliers').then(setSuppliers).catch(() => undefined);
    if (!isNew) {
      get<Product>(`/products/${id}`).then((product) => {
        setForm({
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          description: product.description,
          category: product.category,
          brand: product.brand,
          model: product.model,
          unit: product.unit,
          costPrice: product.costPrice ?? 0,
          salePrice: product.salePrice,
          currentStock: product.currentStock,
          minStock: product.minStock,
          location: product.location,
          supplier: typeof product.supplier === 'object' && product.supplier ? product.supplier._id : '',
          active: product.active,
          images: product.images.join('\n'),
          ncm: product.ncm || '87149990',
          cfop: product.cfop || '5102',
        });
      });
    }
  }, [id, isNew]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    try {
      const payload = {
        ...form,
        sku: form.sku.toUpperCase(),
        supplier: form.supplier || null,
        images: form.images
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      };
      if (isNew) await post('/products', payload);
      else await put(`/products/${id}`, payload);
      navigate('/produtos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    }
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h2>{isNew ? 'Nova peça' : form.name || 'Editar peça'}</h2>
          <p>Custo e venda entram como reais no campo, mas o sistema grava centavos inteiros.</p>
        </div>
      </div>

      <article className="card grid grid-2">
        <fieldset className="contents" disabled={!canEdit} style={{ display: 'contents' }}>
        <label className="field">
          SKU
          <input value={form.sku} onChange={(event) => set('sku', event.target.value)} />
        </label>
        <label className="field">
          Código de barras
          <input value={form.barcode} onChange={(event) => set('barcode', event.target.value)} />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Nome
          <input value={form.name} onChange={(event) => set('name', event.target.value)} />
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Descrição
          <textarea value={form.description} onChange={(event) => set('description', event.target.value)} />
        </label>
        <label className="field">
          Categoria
          <select value={form.category} onChange={(event) => set('category', event.target.value)}>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Marca
          <input value={form.brand} onChange={(event) => set('brand', event.target.value)} />
        </label>
        <label className="field">
          Modelo
          <input value={form.model} onChange={(event) => set('model', event.target.value)} />
        </label>
        <label className="field">
          Unidade
          <select value={form.unit} onChange={(event) => set('unit', event.target.value)}>
            {UNITS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {can('sales') ? (
          <MoneyInput label="Preço de custo" valueCents={form.costPrice} onChangeCents={(value) => set('costPrice', value)} />
        ) : null}
        <MoneyInput label="Preço de venda" valueCents={form.salePrice} onChangeCents={(value) => set('salePrice', value)} />
        {isNew ? (
          <label className="field">
            Estoque inicial
            <input
              type="number"
              value={form.currentStock}
              onChange={(event) => set('currentStock', Number(event.target.value))}
            />
          </label>
        ) : (
          <label className="field">
            Estoque atual
            <input value={form.currentStock} disabled />
          </label>
        )}
        <label className="field">
          Estoque mínimo
          <input
            type="number"
            value={form.minStock}
            onChange={(event) => set('minStock', Number(event.target.value))}
          />
        </label>
        <label className="field">
          Localização
          <input value={form.location} onChange={(event) => set('location', event.target.value)} />
        </label>
        <label className="field">
          NCM
          <input value={form.ncm} onChange={(event) => set('ncm', event.target.value)} />
        </label>
        <label className="field">
          CFOP
          <input value={form.cfop} onChange={(event) => set('cfop', event.target.value)} />
        </label>
        <label className="field">
          Fornecedor
          <select value={form.supplier} onChange={(event) => set('supplier', event.target.value)}>
            <option value="">Sem fornecedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier._id} value={supplier._id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Situação
          <select value={form.active ? '1' : '0'} onChange={(event) => set('active', event.target.value === '1')}>
            <option value="1">Ativo</option>
            <option value="0">Inativo</option>
          </select>
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          Imagens (uma URL por linha)
          <textarea value={form.images} onChange={(event) => set('images', event.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {canEdit ? (
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => void save()}>
              Salvar
            </button>
          </div>
        ) : null}
        </fieldset>
      </article>
    </section>
  );
}
