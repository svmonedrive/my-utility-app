/** One order as stored in the data repo (a year file such as `average-price-app-data/2026.json`). Dates are written as "20-Oct-2026". */
export interface OrderRecord {
  id: number;
  symbol: string;
  buyDate: string;
  buyPrice: number | null;
  quantity: number | null;
  /** Empty while the order is not sold. */
  sellDate: string;
  /** Null while the order is not sold. */
  sellPrice: number | null;
}

/** An order in the table. */
export type TradeRow = OrderRecord;

/** An order without its id: what the order form hands back. */
export type OrderFields = Omit<OrderRecord, 'id'>;

/** The order with its keys always in the same order, so that the saved file and the unsaved check are stable. */
export const toRecord = (row: OrderRecord): OrderRecord => ({
  id: row.id,
  symbol: row.symbol,
  buyDate: row.buyDate,
  buyPrice: row.buyPrice,
  quantity: row.quantity,
  sellDate: row.sellDate,
  sellPrice: row.sellPrice,
});
