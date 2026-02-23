import * as XLSX from 'xlsx';
import { InventoryRow, ImportWarning } from './types';

const REQUIRED = [
  'Produto',
  'Código (SKU)',
  'Preço',
  'UN',
  'Localização',
  'Estoque atual',
  'Estoque disponível'
] as const;

function normHeader(h: unknown): string {
  return String(h ?? '').trim();
}

function parseNumberBR(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;

  // Handle "1.234,56" and "1234,56"
  const hasComma = s.includes(',');
  const cleaned = hasComma
    ? s.replace(/\./g, '').replace(',', '.')
    : s;

  const n = Number(cleaned.replace(/\s/g, ''));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function parseInventoryExcel(buffer: ArrayBuffer): {
  rows: InventoryRow[];
  warnings: ImportWarning[];
  sheetName: string;
} {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Arquivo Excel sem abas.');

  const ws = workbook.Sheets[sheetName];
  const json: unknown[] = XLSX.utils.sheet_to_json(ws, {
    defval: '',
    raw: false
  });

  // Ensure required columns exist
  const headers = json.length ? Object.keys(json[0] as any).map(normHeader) : [];
  const missing = REQUIRED.filter((h) => !headers.includes(h));

  const warnings: ImportWarning[] = [];
  if (missing.length) {
    warnings.push({
      code: 'unknown_columns',
      message: 'Algumas colunas esperadas não foram encontradas; tentando importar mesmo assim.',
      meta: { missing }
    });
  }

  const rows: InventoryRow[] = (json as any[])
    .map((r) => {
      const name = String(r['Produto'] ?? '').trim();
      const skuRaw = String(r['Código (SKU)'] ?? '').trim();
      const sku = skuRaw ? skuRaw : null;
      const unit = String(r['UN'] ?? '').trim() || null;
      const location = String(r['Localização'] ?? '').trim() || null;

      const unitPrice = parseNumberBR(r['Preço']);
      const qtyOnHand = parseNumberBR(r['Estoque atual']) ?? 0;
      const qtyAvailable = parseNumberBR(r['Estoque disponível']) ?? 0;

      return {
        name,
        sku,
        unit,
        location,
        unitPrice: unitPrice === null ? null : unitPrice,
        qtyOnHand,
        qtyAvailable
      } satisfies InventoryRow;
    })
    .filter((r) => r.name.length > 0);

  return { rows, warnings, sheetName };
}
