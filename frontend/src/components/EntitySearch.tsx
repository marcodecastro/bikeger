import { useEffect, useId, useRef, useState } from 'react';

interface EntitySearchProps<T> {
  label: string;
  placeholder?: string;
  emptyLabel?: string;
  value: string;
  selectedLabel?: string;
  disabled?: boolean;
  fetchItems: (query: string) => Promise<T[]>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getExtra?: (item: T) => string;
  onSelect: (item: T | null) => void;
}

export function EntitySearch<T>({
  label,
  placeholder = 'Buscar...',
  emptyLabel,
  value,
  selectedLabel,
  disabled,
  fetchItems,
  getKey,
  getLabel,
  getExtra,
  onSelect,
}: EntitySearchProps<T>) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<T[]>([]);
  const skipFetch = useRef(false);

  useEffect(() => {
    if (value && selectedLabel && !open) setQuery(selectedLabel);
    if (!value && !open && emptyLabel) setQuery('');
  }, [value, selectedLabel, emptyLabel, open]);

  useEffect(() => {
    if (skipFetch.current) {
      skipFetch.current = false;
      return;
    }
    if (!open) return;
    const timer = window.setTimeout(() => {
      void fetchItems(query.trim())
        .then(setHits)
        .catch(() => setHits([]));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query, open, fetchItems]);

  function pick(item: T | null) {
    skipFetch.current = true;
    setOpen(false);
    setHits([]);
    if (!item) {
      setQuery('');
      onSelect(null);
      return;
    }
    setQuery(getLabel(item));
    onSelect(item);
  }

  return (
    <label className="field entity-search">
      {label}
      <input
        value={open || !value ? query : selectedLabel || query}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          if (value && selectedLabel) setQuery('');
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (!event.target.value && value) onSelect(null);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {open ? (
        <div className="search-pop entity-search-pop" id={listId} role="listbox">
          {emptyLabel ? (
            <button type="button" className="search-item btn-ghost" role="option" onMouseDown={() => pick(null)}>
              <span>{emptyLabel}</span>
            </button>
          ) : null}
          {hits.map((item) => (
            <button
              type="button"
              key={getKey(item)}
              className="search-item btn-ghost"
              role="option"
              onMouseDown={() => pick(item)}
            >
              <span>{getLabel(item)}</span>
              {getExtra ? <span className="muted">{getExtra(item)}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}
