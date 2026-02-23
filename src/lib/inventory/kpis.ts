export type SnapshotLineDTO = {
  product_id: string;
  sku_raw: string | null;
  name: string;
  unit_price: number | null;
  qty_on_hand: number;
  qty_available: number;
  value_on_hand: number | null;
};

export function computeKpis(lines: SnapshotLineDTO[]) {
  const totalProducts = lines.length;
  let totalOnHand = 0;
  let totalAvailable = 0;
  let totalValue = 0;
  let valueCount = 0;
  let zeroQty = 0;
  let negativeQty = 0;

  for (const l of lines) {
    totalOnHand += Number(l.qty_on_hand ?? 0);
    totalAvailable += Number(l.qty_available ?? 0);
    if ((l.qty_on_hand ?? 0) === 0) zeroQty++;
    if ((l.qty_on_hand ?? 0) < 0 || (l.qty_available ?? 0) < 0) negativeQty++;
    if (l.value_on_hand !== null && Number.isFinite(l.value_on_hand)) {
      totalValue += Number(l.value_on_hand);
      valueCount++;
    }
  }

  return {
    totalProducts,
    totalOnHand,
    totalAvailable,
    totalValue: valueCount > 0 ? totalValue : null,
    zeroQty,
    negativeQty,
    valueCoverage: totalProducts ? valueCount / totalProducts : 0
  };
}
