import { parseDate } from './date-format';
import { BANK_RATE_PERCENT, isSold } from './returns';
import { TradeRow } from './trade-row';

const DAY_MS = 86_400_000;

/**
 * Whole days since 1-Jan-1970 of a calendar date. Counted in UTC, so a time zone or a daylight-saving
 * change can never make a day count off by one.
 */
export const dayNumber = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;

/** One day of the comparison. Both numbers are totals up to and including that day. */
export interface ReturnsPoint {
  /** Whole days since 1-Jan-1970. */
  day: number;
  /** Interest the same money would have earned in the bank so far. */
  bank: number;
  /** Profit the sold orders made in the market so far. */
  market: number;
}

/** The sale of an order. */
export interface Sale {
  /** Whole days since 1-Jan-1970. */
  day: number;
  /** Sell price of one unit. */
  price: number;
  /** `(sell price − buy price) × quantity`. Negative for a loss. */
  profit: number;
}

/** One order that is counted. */
export interface CountedOrder {
  symbol: string;
  /** Whole days since 1-Jan-1970 of the buy date. */
  buyDay: number;
  /** Buy price of one unit. */
  price: number;
  quantity: number;
  /** `price × quantity`. */
  cost: number;
  /** Null while the order is not sold. */
  sale: Sale | null;
}

/** A day on which something was bought, with everything bought that day. */
export interface Purchase {
  /** Whole days since 1-Jan-1970. */
  day: number;
  orders: CountedOrder[];
}

/** A day on which something was sold, with everything sold that day. */
export interface SaleDay {
  /** Whole days since 1-Jan-1970. */
  day: number;
  /** Sold orders: `order.sale` is always set. */
  orders: CountedOrder[];
}

export interface MarketVsBank {
  /** One point per calendar day, from the first buy date to today. */
  points: ReturnsPoint[];
  /** The days something was bought, oldest first. */
  purchases: Purchase[];
  /** The days something was sold (up to today), oldest first. */
  sales: SaleDay[];
  /** Money put into all the counted orders, sold or not. */
  invested: number;
  /** What the bank would have paid so far on that money, over the same days. */
  bankInterest: number;
  /** `bankInterest` in percent of `invested`. */
  bankInterestPercent: number;
  /** Profit made so far by the orders that are sold. */
  realisedProfit: number;
  /**
   * What the orders not sold yet would make if sold today at `currentPrice`. Null when no price was
   * given, or there is no such order.
   */
  unrealisedProfit: number | null;
  /** The current price that was used for the orders not sold yet, if any. */
  currentPrice: number | null;
  /** `realisedProfit` plus `unrealisedProfit`: what the market line ends at. */
  marketProfit: number;
  /** `marketProfit` in percent of the money in the orders it covers. 0 when it covers none. */
  marketProfitPercent: number;
  /** `marketProfit − bankInterest`: positive when the market is ahead of the bank. */
  difference: number;
  /** How many orders are counted, how many of them are sold, and how many are still held. */
  orders: number;
  sold: number;
  holdings: number;
  /** Orders with a buy date but no usable price, quantity or sell data: they cannot be counted. */
  skipped: number;
}

/**
 * Compares what the orders made in the market with what the same money would have earned in a bank.
 * Sold and unsold orders are all counted. For a day `t`, the two numbers are
 *
 *     bank(t)   = Σ cost × rate × days(buy → min(t, sell day)) / 365
 *     market(t) = Σ (sell price − buy price) × quantity, over the orders sold on or before t
 *
 * with `cost = buy price × quantity`, `rate` the yearly rate (7% → 0.07) and `days` the real calendar
 * days. Every order earns bank interest from its own buy date, until it is sold (money that came back
 * is no longer "in the bank"), or until today if it is not sold. This is the same simple pro-rated
 * interest the Statistics bars use. An order that is not sold has no market profit yet: the data has
 * no market price, so it is not valued, unless `currentPrice` is given. Then every order not sold is
 * valued as if sold today at that price, and the last point of the market line includes that profit
 * (there are no earlier prices, so no earlier day can show it). Pass it only when all the rows are of
 * the one symbol that price belongs to.
 *
 * Returns null when there is nothing to count.
 */
export function compareMarketWithBank(
  rows: readonly TradeRow[],
  today: Date,
  currentPrice: number | null = null,
  ratePercent = BANK_RATE_PERCENT,
): MarketVsBank | null {
  const todayDay = dayNumber(today);
  const counted: { day: number; order: CountedOrder }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const buy = parseDate(row.buyDate);
    if (!buy) {
      continue; // an empty or half-typed row: nothing to count yet
    }
    const day = dayNumber(buy);
    if (day > todayDay) {
      continue; // not bought yet
    }
    const price = row.buyPrice ?? 0;
    const quantity = row.quantity ?? 0;
    const cost = price * quantity;
    if (!(cost > 0)) {
      skipped++;
      continue;
    }
    let sale: Sale | null = null;
    if (isSold(row)) {
      const sell = parseDate(row.sellDate);
      const sellDay = sell ? dayNumber(sell) : -1;
      if (!sell || sellDay < day) {
        skipped++; // a sell date that is not a date, or before the buy date
        continue;
      }
      const sellPrice = row.sellPrice ?? 0;
      sale = { day: sellDay, price: sellPrice, profit: (sellPrice - price) * quantity };
    }
    counted.push({ day, order: { symbol: row.symbol, buyDay: day, price, quantity, cost, sale } });
  }
  if (!counted.length) {
    return null;
  }

  counted.sort((a, b) => a.day - b.day);
  const first = counted[0].day;
  const perDay = ratePercent / 100 / 365;

  const points: ReturnsPoint[] = [];
  for (let day = first; day <= todayDay; day++) {
    let costDays = 0; // Σ cost × days the money has been in the bank so far
    let market = 0;
    for (const { day: buyDay, order } of counted) {
      if (buyDay > day) {
        break; // sorted by buy day: the rest are not bought yet
      }
      const end = order.sale ? Math.min(day, order.sale.day) : day;
      costDays += order.cost * (end - buyDay);
      if (order.sale && order.sale.day <= day) {
        market += order.sale.profit;
      }
    }
    points.push({ day, bank: perDay * costDays, market });
  }

  const purchases: Purchase[] = [];
  let invested = 0;
  let soldCost = 0;
  let sold = 0;
  for (const { day, order } of counted) {
    invested += order.cost;
    if (order.sale && order.sale.day <= todayDay) {
      soldCost += order.cost;
      sold++;
    }
    // Several orders bought on the same day share one purchase.
    const latest = purchases[purchases.length - 1];
    if (latest?.day === day) {
      latest.orders.push(order);
    } else {
      purchases.push({ day, orders: [order] });
    }
  }

  const salesByDay = new Map<number, CountedOrder[]>();
  for (const { order } of counted) {
    if (order.sale && order.sale.day <= todayDay) {
      salesByDay.set(order.sale.day, [...(salesByDay.get(order.sale.day) ?? []), order]);
    }
  }
  const sales: SaleDay[] = [...salesByDay]
    .sort((a, b) => a[0] - b[0])
    .map(([day, orders]) => ({ day, orders }));

  const holdings = counted.length - sold;
  const last = points[points.length - 1];
  const realisedProfit = last.market;

  // Orders not sold yet, valued at the current price as if sold today.
  const price = currentPrice !== null && currentPrice > 0 && holdings > 0 ? currentPrice : null;
  let unrealisedProfit: number | null = null;
  if (price !== null) {
    unrealisedProfit = 0;
    for (const { order } of counted) {
      if (!order.sale || order.sale.day > todayDay) {
        unrealisedProfit += (price - order.price) * order.quantity;
      }
    }
    points[points.length - 1] = { ...last, market: realisedProfit + unrealisedProfit };
  }
  const marketProfit = realisedProfit + (unrealisedProfit ?? 0);
  const covered = unrealisedProfit === null ? soldCost : invested;

  return {
    points,
    purchases,
    sales,
    invested,
    bankInterest: last.bank,
    bankInterestPercent: (last.bank / invested) * 100,
    realisedProfit,
    unrealisedProfit,
    currentPrice: price,
    marketProfit,
    marketProfitPercent: covered > 0 ? (marketProfit / covered) * 100 : 0,
    difference: marketProfit - last.bank,
    orders: counted.length,
    sold,
    holdings,
    skipped,
  };
}
