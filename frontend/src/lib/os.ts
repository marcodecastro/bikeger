export function openOsPath(opts?: { customerId?: string; bikeId?: string }) {
  const params = new URLSearchParams({ nova: '1' });
  if (opts?.customerId) params.set('cliente', opts.customerId);
  if (opts?.bikeId) params.set('bike', opts.bikeId);
  return `/oficina?${params.toString()}`;
}
