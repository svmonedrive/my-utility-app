import { parseDate } from './date-format';
import { TradeRow } from './sample-data';

/** Yearly return the money would have earned in a bank instead. */
export const BANK_RATE_PERCENT = 7;

/** What a bank would have given on the same money over the holding period. */
export interface BankReturn {
  /** Simple interest, pro-rated by days, in percent. */
  bankPercent: number;
  days: number;
  /** Money put in: buy price x quantity. Null when the quantity is missing. */
  investedAmount: number | null;
  /** Rupees a bank would have given: invested x bank percent. Null when the quantity is missing. */
  bankAmount: number | null;
}

/** A sold order: the actual return next to the bank return. */
export interface Returns extends BankReturn {
  /** Return actually made: (sell - buy) / buy, in percent. Negative for a loss. */
  actualPercent: number;
  /** Rupee profit/loss: (sell - buy) x quantity. Null when the quantity is missing. */
  actualAmount: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** An order is sold once it has both a sell date and a sell price. */
export const isSold = (row: TradeRow): boolean =>
  row.sellDate.trim() !== '' && row.sellPrice !== null;

function bankReturn(buyPrice: number, quantity: number | null, days: number): BankReturn {
  const bankPercent = (BANK_RATE_PERCENT * days) / 365;
  const qty = quantity !== null && quantity > 0 ? quantity : null;
  return {
    bankPercent,
    days,
    investedAmount: qty === null ? null : buyPrice * qty,
    bankAmount: qty === null ? null : (buyPrice * qty * bankPercent) / 100,
  };
}

/** Returns null while the order is not sold yet, or its values are incomplete or inconsistent. */
export function calcReturns(row: TradeRow): Returns | null {
  const buy = parseDate(row.buyDate);
  const sell = parseDate(row.sellDate);
  if (!buy || !sell || !row.buyPrice || row.buyPrice <= 0 || row.sellPrice === null) {
    return null;
  }
  const days = Math.round((sell.getTime() - buy.getTime()) / DAY_MS);
  if (days < 0) {
    return null;
  }
  const quantity = row.quantity !== null && row.quantity > 0 ? row.quantity : null;
  return {
    ...bankReturn(row.buyPrice, row.quantity, days),
    actualPercent: ((row.sellPrice - row.buyPrice) / row.buyPrice) * 100,
    actualAmount: quantity === null ? null : (row.sellPrice - row.buyPrice) * quantity,
  };
}

/** Days from the buy date to the sell date. Null without two usable dates, or if sold before bought. */
export function daysHeld(row: TradeRow): number | null {
  const buy = parseDate(row.buyDate);
  const sell = parseDate(row.sellDate);
  if (!buy || !sell) {
    return null;
  }
  const days = Math.round((sell.getTime() - buy.getTime()) / DAY_MS);
  return days < 0 ? null : days;
}

/** Days from the buy date until `today`. Null without a usable buy date. Never negative. */
export function daysSinceBuy(row: TradeRow, today: Date): number | null {
  const buy = parseDate(row.buyDate);
  return buy ? Math.max(0, Math.round((today.getTime() - buy.getTime()) / DAY_MS)) : null;
}

/**
 * For an order that is not sold yet: what a bank would have given from the buy date until `today`.
 * Null without a usable buy date and price.
 */
export function calcPendingReturns(row: TradeRow, today: Date): BankReturn | null {
  const buy = parseDate(row.buyDate);
  if (!buy || !row.buyPrice || row.buyPrice <= 0) {
    return null;
  }
  const days = Math.max(0, Math.round((today.getTime() - buy.getTime()) / DAY_MS));
  return bankReturn(row.buyPrice, row.quantity, days);
}
