import { parseDate } from '../date-format';
import { describePending, describeReturns } from '../return-popover/return-details';
import { calcPendingReturns, calcReturns, daysHeld, daysSinceBuy, isSold } from '../returns';
import { TradeRow } from '../trade-row';
import { ALL_SYMBOLS, ReturnBar, SymbolFilter } from './orders-table';

/**
 * The small pure functions of the orders table. They depend on nothing in Angular and on no state, so
 * the component only has to wire them in. None of them uses `this`, so they can also be handed
 * around as plain functions, e.g. `protected readonly rowStyle = OrdersTableHelper.monthRowStyle`.
 */
export class OrdersTableHelper {
  /** Keeps a row's cells (and what is typed in them) when the list of rows changes. */
  static trackById(_index: number, row: TradeRow): number {
    return row.id;
  }

  /**
   * Row background: a light colour per calendar month of the buy date. Each month is 150deg around the
   * colour wheel from the previous one, so neighbouring months never look alike (Dec to Jan included).
   * No buy date yet, no colour.
   */
  static monthRowStyle(row: TradeRow): Record<string, string> | null {
    const date = parseDate(row.buyDate);
    return date ? { background: `hsl(${(date.getMonth() * 150) % 360}, 75%, 86%)` } : null;
  }

  /**
   * The rows the filters let through: the chosen symbol, the chosen month of the buy date (0 = January;
   * null for every month) and optionally only unsold orders.
   */
  static filterOrders(
    rows: readonly TradeRow[],
    symbol: SymbolFilter,
    month: number | null,
    onlyNotSold: boolean,
  ): TradeRow[] {
    return rows.filter(
      (row) =>
        (symbol === ALL_SYMBOLS || row.symbol === symbol) &&
        (month === null || parseDate(row.buyDate)?.getMonth() === month) &&
        (!onlyNotSold || !isSold(row)),
    );
  }

  /** The bars and popover details of every row that has enough data for them, by row id. */
  static buildReturnBars(rows: readonly TradeRow[], today: Date): Map<number, ReturnBar> {
    const bars = new Map<number, ReturnBar>();
    for (const row of rows) {
      if (!isSold(row)) {
        // Not sold yet: the bank bar fills the cell; the actual bar is a dotted outline (not known yet).
        const pending = calcPendingReturns(row, today);
        if (pending) {
          bars.set(row.id, {
            actualWidth: 100,
            bankWidth: 100,
            details: describePending(pending),
          });
        }
        continue;
      }
      const returns = calcReturns(row);
      if (!returns) {
        continue;
      }
      const { actualPercent: actual, bankPercent: bank } = returns;
      const larger = Math.max(Math.abs(actual), bank);
      bars.set(row.id, {
        actualWidth: larger > 0 ? (Math.abs(actual) / larger) * 100 : 0,
        bankWidth: larger > 0 ? (bank / larger) * 100 : 0,
        details: describeReturns(returns),
      });
    }
    return bars;
  }

  /**
   * While there is no sell date: how long the order has been open, e.g. "(34 days over)".
   * Goes away as soon as a sell date is entered, even if the sell price is still missing.
   */
  static daysOverText(row: TradeRow, today: Date): string {
    const days = row.sellDate.trim() === '' ? daysSinceBuy(row, today) : null;
    return days === null ? '' : `(${OrdersTableHelper.daysLabel(days)} over)`;
  }

  /** Once there is a sell date: how long the order was held, e.g. "(23 days)", shown under the date. */
  static daysHeldText(row: TradeRow): string {
    const days = daysHeld(row);
    return days === null ? '' : `(${OrdersTableHelper.daysLabel(days)})`;
  }

  /** True for typed date text that is not empty but not a real date either (it gets a red border). */
  static isInvalidDate(text: string): boolean {
    return text.trim() !== '' && parseDate(text) === null;
  }

  private static daysLabel(days: number): string {
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
}
