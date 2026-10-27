import { BRAZIL_UFS } from '../lib/labels';
import type { Customer } from '../types';

export interface CustomerAddressForm {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

export const emptyAddress: CustomerAddressForm = {
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  zip: '',
};

export function addressFromCustomer(customer?: Customer | null): CustomerAddressForm {
  return {
    street: customer?.address?.street || '',
    number: customer?.address?.number || '',
    neighborhood: customer?.address?.neighborhood || '',
    city: customer?.address?.city || '',
    state: (customer?.address?.state || '').toUpperCase(),
    zip: customer?.address?.zip || '',
  };
}

export function addressPayload(address: CustomerAddressForm) {
  return {
    street: address.street.trim(),
    number: address.number.trim(),
    neighborhood: address.neighborhood.trim(),
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
    zip: address.zip.trim(),
  };
}

interface CustomerAddressFieldsProps {
  address: CustomerAddressForm;
  onChange: (next: CustomerAddressForm) => void;
}

export function CustomerAddressFields({ address, onChange }: CustomerAddressFieldsProps) {
  function set<K extends keyof CustomerAddressForm>(key: K, value: CustomerAddressForm[K]) {
    onChange({ ...address, [key]: value });
  }

  return (
    <>
      <label className="field" style={{ gridColumn: '1 / -1' }}>
        Rua
        <input value={address.street} onChange={(event) => set('street', event.target.value)} />
      </label>
      <label className="field">
        Número
        <input value={address.number} onChange={(event) => set('number', event.target.value)} />
      </label>
      <label className="field">
        Bairro
        <input value={address.neighborhood} onChange={(event) => set('neighborhood', event.target.value)} />
      </label>
      <label className="field">
        Cidade
        <input value={address.city} onChange={(event) => set('city', event.target.value)} />
      </label>
      <label className="field">
        UF
        <select value={address.state} onChange={(event) => set('state', event.target.value)}>
          <option value="">UF</option>
          {BRAZIL_UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        CEP
        <input value={address.zip} onChange={(event) => set('zip', event.target.value)} inputMode="numeric" />
      </label>
    </>
  );
}
