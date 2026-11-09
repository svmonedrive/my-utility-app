import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdersService } from '../orders.service';
import { ALL_SYMBOLS, MONTH_OPTIONS } from '../orders-table/orders-table';
import { OrdersFilterService } from './orders-filter.service';

/**
 * The filters of the orders table, in this order: by symbol (from the symbols of the index), "Holding",
 * which lists only the orders that are not sold yet, and by month of the buy date. While one symbol is
 * chosen with Holding on, an input for that symbol's current price shows in front of them. It only sets
 * `OrdersFilterService`; the table and the chart apply it.
 */
@Component({
  selector: 'app-orders-filter',
  imports: [FormsModule],
  styleUrl: './orders-filter.component.scss',
  templateUrl: './orders-filter.component.html',
})
export class OrdersFilterComponent {
  protected readonly orders = inject(OrdersService);
  protected readonly filter = inject(OrdersFilterService);
  protected readonly allSymbols = ALL_SYMBOLS;
  protected readonly months = MONTH_OPTIONS;

  /** The month dropdown's value: the month number, or empty for every month. */
  protected setMonth(value: string): void {
    this.filter.month.set(value === '' ? null : Number(value));
  }

  /**
   * The current price input. `change` fires when the input loses focus (or Enter is pressed) after it
   * was edited, not on every key, so the chart is calculated once the price is fully typed. A price
   * that is empty or not above zero clears it.
   */
  protected applyCurrentPrice(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.valueAsNumber;
    this.filter.setCurrentPrice(Number.isFinite(value) ? value : null);
    // Show what was kept: an empty box when the typed value was not a usable price.
    input.value = this.filter.currentPrice()?.toString() ?? '';
  }

  protected toggleHolding(): void {
    this.filter.onlyNotSold.update((on) => !on);
  }
}
