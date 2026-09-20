interface StoreBrandProps {
  name?: string;
  logo?: string;
  tagline?: string;
}

export function StoreBrand({ name, logo, tagline }: StoreBrandProps) {
  const title = name?.trim() || 'BikeGer';
  return (
    <div className="brand">
      {logo ? (
        <img className="brand-logo" src={logo} alt={title} />
      ) : (
        <div className="brand-mark">BG</div>
      )}
      <div className="brand-copy">
        <h1>{title}</h1>
        {tagline ? <p>{tagline}</p> : null}
      </div>
    </div>
  );
}
