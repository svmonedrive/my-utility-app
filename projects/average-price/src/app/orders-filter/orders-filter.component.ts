import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdersService } from '../orders.service';
import { ALL_SYMBOLS, MONTH_OPTIONS } from '../orders-table/orders-table';
import { OrdersFilterService } from './orders-filter.service';

/**
 * The filters of the orders table: by symbol (from the symbols of the index), by month of the buy date,
 * and "Holding", which lists only the orders that are not sold yet. It only sets `OrdersFilterService`; the table applies it.
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

  protected toggleHolding(): void {
    this.filter.onlyNotSold.update((on) => !on);
  }
}
