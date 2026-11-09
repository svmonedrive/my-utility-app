import { computed, inject, Injectable, signal } from '@angular/core';
import { OrdersService } from '../orders.service';
import { ALL_SYMBOLS, SymbolFilter } from '../orders-table/orders-table';
import { OrdersTableHelper } from '../orders-table/orders-table.helper';
import { isSold } from '../returns';

/**
 * What the filters (symbol, month, Holding) are set to, and the orders they let through. The filter
 * component (in the toolbar) changes the filters; the table and the chart both read `visibleRows`, so
 * what the chart counts is always exactly what the table lists.
 */
@Injectable({ providedIn: 'root' })
export class OrdersFilterService {
  private readonly orders = inject(OrdersService);

  /** One symbol, or `ALL_SYMBOLS` for no filtering by symbol. */
  readonly symbol = signal<SymbolFilter>(ALL_SYMBOLS);

  /** The month of the buy date to show (0 = January), or null for every month. */
  readonly month = signal<number | null>(null);

  /** When on, only the orders that are not sold yet ("Holding") are listed. */
  readonly onlyNotSold = signal(false);

  /** The current market price typed for each symbol. Kept only while the page is open. */
  readonly currentPrices = signal<Record<string, number | null>>({});

  /** The current price typed for the chosen symbol, or null. */
  readonly currentPrice = computed(() => this.currentPrices()[this.symbol()] ?? null);

  /** Sets (or, with null, clears) the current price of the chosen symbol. */
  setCurrentPrice(price: number | null): void {
    const symbol = this.symbol();
    this.currentPrices.update((prices) => ({ ...prices, [symbol]: price && price > 0 ? price : null }));
  }

  /** The orders of the year on screen that pass all the filters. */
  readonly visibleRows = computed(() =>
    OrdersTableHelper.filterOrders(
      this.orders.rows(),
      this.symbol(),
      this.month(),
      this.onlyNotSold(),
    ),
  );

  /**
   * Whether the current price input shows, and its price counts: one symbol is chosen, the Holding
   * filter is on, and the orders listed include some that are not sold yet (a price is only needed to
   * value those).
   */
  readonly showCurrentPrice = computed(
    () =>
      this.symbol() !== ALL_SYMBOLS &&
      this.onlyNotSold() &&
      this.visibleRows().some((row) => !isSold(row)),
  );
}
