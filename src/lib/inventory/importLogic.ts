import { InventoryRow, ImportWarning } from './types';

export type AggregatedRow = InventoryRow & {
  sourceCount: number;
};

function keyForRow(r: InventoryRow): string {
  if (r.sku && r.sku.trim()) return `SKU:${r.sku.trim().toUpperCase()}`;
  return `NAME:${r.name.trim().toUpperCase()}`;
}

export function aggregateAndValidate(rows: InventoryRow[]): {
  aggregated: AggregatedRow[];
  warnings: ImportWarning[];
  stats: {
    rowsRead: number;
    rowsAggregated: number;
    missingSkuCount: number;
    duplicateSkuCount: number;
    negativeStockCount: number;
    zeroPriceCount: number;
  };
} {
  const warnings: ImportWarning[] = [];

  let missingSkuCount = 0;
  let duplicateSkuCount = 0;
  let negativeStockCount = 0;
  let zeroPriceCount = 0;

  // Track duplicates by SKU within this import
  const skuCounts = new Map<string, number>();
  for (const r of rows) {
    const sku = r.sku?.trim();
    if (!sku) {
      missingSkuCount++;
      continue;
    }
    skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  }
  for (const [sku, c] of skuCounts.entries()) {
    if (c > 1) duplicateSkuCount += (c - 1);
  }

  if (missingSkuCount > 0) {
    warnings.push({
      code: 'missing_sku',
      message: `Existem ${missingSkuCount} linhas com SKU vazio; esses itens serão identificados pelo nome.`
    });
  }
  if (duplicateSkuCount > 0) {
    warnings.push({
      code: 'duplicate_sku_aggregated',
      message: `Foram detectadas duplicidades de SKU na mesma semana; as linhas serão agregadas (somadas) por SKU.`
    });
  }

  const grouped = new Map<string, AggregatedRow>();
  for (const r of rows) {
    if (r.qtyOnHand < 0 || r.qtyAvailable < 0) negativeStockCount++;
    if ((r.unitPrice ?? 0) === 0) zeroPriceCount++;

    const k = keyForRow(r);
    const existing = grouped.get(k);
    if (!existing) {
      grouped.set(k, { ...r, sourceCount: 1 });
      continue;
    }

    // aggregate quantities
    existing.qtyOnHand += r.qtyOnHand;
    existing.qtyAvailable += r.qtyAvailable;

    // choose best unit/location
    existing.unit = existing.unit ?? r.unit;
    existing.location = existing.location ?? r.location;

    // choose unitPrice: prefer >0 and max
    const a = existing.unitPrice ?? 0;
    const b = r.unitPrice ?? 0;
    if (b > a) existing.unitPrice = b;

    existing.sourceCount += 1;
  }

  if (negativeStockCount > 0) {
    warnings.push({
      code: 'negative_stock',
      message: `Existem ${negativeStockCount} linhas com estoque negativo (atual ou disponível). Elas serão importadas e sinalizadas.`
    });
  }
  if (zeroPriceCount > 0) {
    warnings.push({
      code: 'zero_price',
      message: `Existem ${zeroPriceCount} linhas com preço 0; o valor total do estoque será calculado de forma parcial.`
    });
  }

  const aggregated = Array.from(grouped.values());

  return {
    aggregated,
    warnings,
    stats: {
      rowsRead: rows.length,
      rowsAggregated: aggregated.length,
      missingSkuCount,
      duplicateSkuCount,
      negativeStockCount,
      zeroPriceCount
    }
  };
}
