import { formatDate } from './date-format';

/** The options of the Symbol dropdown. */
export const SYMBOLS = ['Nifty', 'Others'] as const;
export type TradeSymbol = (typeof SYMBOLS)[number];

export interface TradeRow {
  id: number;
  editing: boolean;
  symbol: TradeSymbol;
  buyDate: string;
  buyPrice: number | null;
  quantity: number | null;
  sellDate: string;
  sellPrice: number | null;
}

/** Orders that are not sold yet: the newest few, plus an occasional older one. */
export const isUnsold = (i: number): boolean => i < 6 || i % 15 === 9;

/** Deterministic dummy orders: `count` rows, newest buy date first. Sold rows were sold a few weeks after buying; unsold rows have no sell date/price. */
export function createSampleRows(
  count: number,
  latestBuy = new Date(2026, 9, 20),
  today = new Date(2026, 9, 30),
): TradeRow[] {
  return Array.from({ length: count }, (_, i) => {
    const buy = new Date(
      latestBuy.getFullYear(),
      latestBuy.getMonth(),
      latestBuy.getDate() - i * 3,
    );
    // Held 3 to 14 weeks, but never sold after today.
    const hold = 21 + ((i * 13) % 78);
    const sell = new Date(
      Math.min(
        new Date(buy.getFullYear(), buy.getMonth(), buy.getDate() + hold).getTime(),
        today.getTime(),
      ),
    );
    const buyPrice = 90 + ((i * 7) % 40);
    const unsold = isUnsold(i);
    return {
      id: i + 1,
      editing: false,
      symbol: SYMBOLS[0], // Nifty is the default
      buyDate: formatDate(buy),
      buyPrice,
      quantity: 1 + ((i * 3) % 25),
      sellDate: unsold ? '' : formatDate(sell),
      sellPrice: unsold ? null : buyPrice + ((i * 11) % 13) - 4,
    };
  });
}
