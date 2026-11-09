import { Injectable, signal } from '@angular/core';
import { ALL_SYMBOLS, SymbolFilter } from '../orders-table/orders-table';

/**
 * What the table filters (symbol, month, Holding) are set to. The filter component (in the toolbar) changes it and the
 * table reads it, so neither needs to know about the other.
 */
@Injectable({ providedIn: 'root' })
export class OrdersFilterService {
  /** One symbol, or `ALL_SYMBOLS` for no filtering by symbol. */
  readonly symbol = signal<SymbolFilter>(ALL_SYMBOLS);

  /** The month of the buy date to show (0 = January), or null for every month. */
  readonly month = signal<number | null>(null);

  /** When on, only the orders that are not sold yet ("Holding") are listed. */
  readonly onlyNotSold = signal(false);
}
