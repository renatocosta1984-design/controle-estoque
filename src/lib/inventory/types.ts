export type InventoryRow = {
  name: string;
  sku: string | null;
  unit: string | null;
  location: string | null;
  unitPrice: number | null;
  qtyOnHand: number;
  qtyAvailable: number;
};

export type ImportWarning = {
  code:
    | 'missing_sku'
    | 'duplicate_sku_aggregated'
    | 'negative_stock'
    | 'zero_price'
    | 'unknown_columns';
  message: string;
  meta?: Record<string, unknown>;
};
