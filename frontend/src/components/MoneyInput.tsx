import { useEffect, useState } from 'react';
import { formatBRL, parseBRLToCents } from '../lib/money';

interface MoneyInputProps {
  label: string;
  valueCents: number;
  onChangeCents: (cents: number) => void;
}

export function MoneyInput({ label, valueCents, onChangeCents }: MoneyInputProps) {
  const [text, setText] = useState(formatBRL(valueCents).replace('R$ ', ''));

  useEffect(() => {
    setText(formatBRL(valueCents).replace('R$ ', ''));
  }, [valueCents]);

  return (
    <label className="field">
      {label}
      <input
        value={text}
        inputMode="decimal"
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const cents = parseBRLToCents(text);
          onChangeCents(cents);
          setText(formatBRL(cents).replace('R$ ', ''));
        }}
      />
    </label>
  );
}
