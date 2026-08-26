export function formatBaht(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatQty(n: number): string {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

export function formatDateThai(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTimeThai(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
