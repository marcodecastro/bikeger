import { OS_STATUS } from './labels';
import { formatBRL } from './money';
import type { MonthReport } from '../types';

function cell(value: string | number) {
  const text = String(value);
  if (/[;"\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function row(values: Array<string | number>) {
  return values.map(cell).join(';');
}

export function monthReportFileName(report: MonthReport) {
  return `bikeger-relatorio-${report.year}-${String(report.month).padStart(2, '0')}.csv`;
}

export function monthReportCsv(report: MonthReport) {
  const lines = [
    row(['BikeGer', `Relatório ${String(report.month).padStart(2, '0')}/${report.year}`]),
    row(['Período', report.from, report.to]),
    '',
    row(['Indicador', 'Valor', 'Detalhe']),
    row(['Vendas pagas', formatBRL(report.sales.revenue), `${report.sales.count} cupons`]),
    row(['Custo das peças vendidas', formatBRL(report.sales.cost), '']),
    row(['Margem das peças', formatBRL(report.sales.margin), 'venda − custo']),
    row(['OS no mês', formatBRL(report.workshop.revenue), `${report.workshop.opened} abertas · ${report.workshop.delivered} entregues`]),
    row(['Estoque a custo', formatBRL(report.stock.value), `${report.stock.units} un · giro ${report.stock.giro.toFixed(2)}`]),
    row(['Compras recebidas', formatBRL(report.purchases.total), `${report.purchases.count} lote(s)`]),
    row(['Peças saídas (venda + OS)', report.stock.outQty, '']),
    '',
    row(['Oficina agora', 'Quantidade']),
    ...Object.entries(report.workshop.byStatus).map(([status, qty]) =>
      row([OS_STATUS[status] || status, qty]),
    ),
  ];
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadTextFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
