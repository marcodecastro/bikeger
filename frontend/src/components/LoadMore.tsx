interface LoadMoreProps {
  hasMore: boolean;
  loading?: boolean;
  onClick: () => void;
  label?: string;
}

export function LoadMore({ hasMore, loading, onClick, label = 'Ver mais' }: LoadMoreProps) {
  if (!hasMore) return null;
  return (
    <div className="row" style={{ marginTop: 12 }}>
      <button type="button" className="btn" disabled={loading} onClick={onClick}>
        {loading ? 'Carregando...' : label}
      </button>
    </div>
  );
}
