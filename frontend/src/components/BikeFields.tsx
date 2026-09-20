import { BIKE_TYPES } from '../lib/labels';

interface BikeFieldsProps {
  brand: string;
  model: string;
  type: string;
  onBrand: (value: string) => void;
  onModel: (value: string) => void;
  onType: (value: string) => void;
  serialNumber?: string;
  color?: string;
  frameSize?: string;
  onSerialNumber?: (value: string) => void;
  onColor?: (value: string) => void;
  onFrameSize?: (value: string) => void;
}

export function BikeFields({
  brand,
  model,
  type,
  onBrand,
  onModel,
  onType,
  serialNumber,
  color,
  frameSize,
  onSerialNumber,
  onColor,
  onFrameSize,
}: BikeFieldsProps) {
  return (
    <>
      <label className="field">
        Marca
        <input value={brand} onChange={(event) => onBrand(event.target.value)} />
      </label>
      <label className="field">
        Modelo
        <input value={model} onChange={(event) => onModel(event.target.value)} />
      </label>
      <label className="field">
        Tipo
        <select value={type} onChange={(event) => onType(event.target.value)}>
          {Object.entries(BIKE_TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {onSerialNumber ? (
        <label className="field">
          Série / quadro
          <input
            value={serialNumber || ''}
            onChange={(event) => onSerialNumber(event.target.value)}
            placeholder="Número de série"
          />
        </label>
      ) : null}
      {onColor ? (
        <label className="field">
          Cor
          <input value={color || ''} onChange={(event) => onColor(event.target.value)} />
        </label>
      ) : null}
      {onFrameSize ? (
        <label className="field">
          Tamanho
          <input
            value={frameSize || ''}
            onChange={(event) => onFrameSize(event.target.value)}
            placeholder="M, 54, 17..."
          />
        </label>
      ) : null}
    </>
  );
}
