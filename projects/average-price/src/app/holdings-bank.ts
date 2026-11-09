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

/** One day of the comparison. */
export interface HoldingsPoint {
  /** Whole days since 1-Jan-1970. */
  day: number;
  /** Money put into the holdings bought up to and including this day. */
  invested: number;
  /** What the same money would be worth in the bank on this day. */
  bank: number;
}

/** One order bought on a purchase day. */
export interface HoldingsOrder {
  symbol: string;
  /** Buy price of one unit. */
  price: number;
  quantity: number;
  /** `price × quantity`. */
  cost: number;
}

/** A day on which something was bought, with everything bought that day. */
export interface HoldingsPurchase {
  /** Whole days since 1-Jan-1970. */
  day: number;
  orders: HoldingsOrder[];
  /** Total invested once this day's purchases are in. */
  investedAfter: number;
}

export interface HoldingsVsBank {
  /** One point per calendar day, from the first buy date to today. */
  points: HoldingsPoint[];
  /** The days something was bought, oldest first. */
  purchases: HoldingsPurchase[];
  /** Today's totals. */
  invested: number;
  bank: number;
  /** What the bank would have paid so far: `bank - invested`. */
  interest: number;
  interestPercent: number;
  /** How long the money has been in the holdings on average, weighted by amount, in days. */
  averageDays: number;
  /** How many holdings are counted. */
  holdings: number;
  /** Unsold orders with a buy date but no price or quantity: they cannot be counted. */
  skipped: number;
}

/**
 * Compares the holdings (the orders not sold yet) with the same money kept in a bank.
 *
 * Every holding is bought on its own day, so each one earns bank interest from its own buy date, not
 * from a common start. For a day `t`, the bank value is the sum over every holding bought on or before
 * `t` of
 *
 *     cost × (1 + rate × days(buy → t) / 365)
 *
 * with `cost = buy price × quantity`, `rate` the yearly rate (7% → 0.07) and `days` the real calendar
 * days between the buy date and `t`. This is the same simple pro-rated interest the Statistics bars
 * use. A holding is valued at cost: the data has no market price.
 *
 * To stay exact and fast, the sums are kept running while walking day by day:
 * `bank(t) = invested + rate/365 × (t × Σcost − Σ cost×buyDay)`, with days counted from the first buy.
 *
 * Returns null when there is nothing to count.
 */
export function compareHoldingsWithBank(
  rows: readonly TradeRow[],
  today: Date,
  ratePercent = BANK_RATE_PERCENT,
): HoldingsVsBank | null {
  const todayDay = dayNumber(today);
  const holdings: { day: number; order: HoldingsOrder }[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (isSold(row)) {
      continue;
    }
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
    if (cost > 0) {
      holdings.push({ day, order: { symbol: row.symbol, price, quantity, cost } });
    } else {
      skipped++;
    }
  }
  if (!holdings.length) {
    return null;
  }

  holdings.sort((a, b) => a.day - b.day);
  const first = holdings[0].day;
  const perDay = ratePercent / 100 / 365;
  const points: HoldingsPoint[] = [];
  const purchases: HoldingsPurchase[] = [];
  let next = 0;
  let invested = 0;
  let weighted = 0; // sum of cost × (buy day − first day)

  for (let day = first; day <= todayDay; day++) {
    while (next < holdings.length && holdings[next].day <= day) {
      const { day: buyDay, order } = holdings[next];
      invested += order.cost;
      weighted += order.cost * (buyDay - first);
      // Several orders bought on the same day share one purchase.
      const latest = purchases[purchases.length - 1];
      if (latest?.day === day) {
        latest.orders.push(order);
        latest.investedAfter = invested;
      } else {
        purchases.push({ day, orders: [order], investedAfter: invested });
      }
      next++;
    }
    points.push({ day, invested, bank: invested + perDay * ((day - first) * invested - weighted) });
  }

  const last = points[points.length - 1];
  const interest = last.bank - last.invested;
  return {
    points,
    purchases,
    invested: last.invested,
    bank: last.bank,
    interest,
    interestPercent: (interest / last.invested) * 100,
    averageDays: ((todayDay - first) * invested - weighted) / invested,
    holdings: holdings.length,
    skipped,
  };
}
