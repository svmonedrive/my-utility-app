/** The options of the Symbol dropdown. */
export const SYMBOLS = ['Nifty', 'Others'] as const;
export type TradeSymbol = (typeof SYMBOLS)[number];

/** One order as stored in the data repo (`average-price-app-data/orders.json`). Dates are written as "20-Oct-2026". */
export interface OrderRecord {
  id: number;
  symbol: TradeSymbol;
  buyDate: string;
  buyPrice: number | null;
  quantity: number | null;
  /** Empty while the order is not sold. */
  sellDate: string;
  /** Null while the order is not sold. */
  sellPrice: number | null;
}

/** An order in the table: the stored record plus whether its row is being edited. */
export interface TradeRow extends OrderRecord {
  editing: boolean;
}

/** The part of a row that is stored (not the editing flag), with the keys always in the same order. */
export const toRecord = (row: TradeRow): OrderRecord => ({
  id: row.id,
  symbol: row.symbol,
  buyDate: row.buyDate,
  buyPrice: row.buyPrice,
  quantity: row.quantity,
  sellDate: row.sellDate,
  sellPrice: row.sellPrice,
});
