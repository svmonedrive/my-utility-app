const format = (n: number, minFraction: number): string =>
  n.toLocaleString('en-IN', { minimumFractionDigits: minFraction, maximumFractionDigits: 2 });

/** "Rs. 1,25,000" (Indian digit grouping). Empty for no value. */
export const formatRupees = (n: number | null, minFraction = 0): string =>
  n === null ? '' : `Rs. ${format(n, minFraction)}`;

/** "+440.00" / "-120.50", always signed and with two decimals; no currency. */
export const formatSignedAmount = (n: number): string =>
  `${n < 0 ? '-' : n > 0 ? '+' : ''}${format(Math.abs(n), 2)}`;

export interface PriceCell {
  /** The total amount, e.g. "Rs. 1,000"; just the price when there is no usable quantity. */
  main: string;
  /** Under the total, e.g. "(Rs. 100/per item)"; empty when there is no usable quantity. */
  perItem: string;
}

/** What a price cell shows: the total (price x quantity) and the price per item. Null without a price. */
export const formatPriceCell = (
  price: number | null,
  quantity: number | null,
): PriceCell | null => {
  if (price === null) {
    return null;
  }
  return quantity !== null && quantity > 0
    ? { main: formatRupees(price * quantity), perItem: `(${formatRupees(price)}/per item)` }
    : { main: formatRupees(price), perItem: '' };
};
