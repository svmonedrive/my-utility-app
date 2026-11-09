import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DataTableComponent,
  LibTdActionDirective,
  LibTdDirective,
  LibThActionDirective,
  LibThDirective,
  PopoverService,
  RowEvent,
} from '@my-utility/shared';
import { formatDate, normalizeDateText, parseDate, parseIsoDate, toIsoDate } from '../date-format';
import { formatPriceCell } from '../money';
import { OrdersService } from '../orders.service';
import { SYMBOLS, TradeRow } from '../trade-row';
import { ReturnDetails } from '../return-popover/return-details';
import { ReturnPopoverComponent } from '../return-popover/return-popover.component';
import {
  ALL_SYMBOLS,
  DOUBLE_TAP_MS,
  ORDERS_COLUMNS,
  ReturnBar,
  SymbolFilter,
} from './orders-table';
import { OrdersTableHelper } from './orders-table.helper';

@Component({
  selector: 'app-orders-table',
  imports: [
    FormsModule,
    DataTableComponent,
    LibThDirective,
    LibTdDirective,
    LibThActionDirective,
    LibTdActionDirective,
  ],
  styleUrl: './orders-table.component.scss',
  templateUrl: './orders-table.component.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'hidePopover()',
  },
})
export class OrdersTableComponent {
  protected readonly orders = inject(OrdersService);
  private readonly popovers = inject(PopoverService);

  // What the template uses from the meta file (`orders-table.ts`), the helper class and elsewhere.
  protected readonly columns = ORDERS_COLUMNS;
  protected readonly trackById = OrdersTableHelper.trackById;
  protected readonly rowStyle = OrdersTableHelper.monthRowStyle;
  protected readonly daysHeldText = OrdersTableHelper.daysHeldText;
  protected readonly isInvalidDate = OrdersTableHelper.isInvalidDate;
  protected readonly priceCell = formatPriceCell;
  protected readonly symbols = SYMBOLS;
  protected readonly allSymbols = ALL_SYMBOLS;

  /** When on, only the orders that are not sold yet are listed. */
  protected readonly onlyNotSold = signal(false);

  /** The Symbol filter in the column header: one symbol, or `All` for no filtering. */
  protected readonly symbolFilter = signal<SymbolFilter>(ALL_SYMBOLS);

  /**
   * The rows to list: the "Holding" filter and the Symbol filter both apply. Recomputed when the rows
   * list changes, so a row being edited stays in the list until it is marked Done, even if it just
   * got a sell price or a different symbol.
   */
  protected readonly visibleRows = computed(() =>
    OrdersTableHelper.filterOrders(this.orders.rows(), this.symbolFilter(), this.onlyNotSold()),
  );

  /** Recomputed when the rows list changes, e.g. when a row is marked Done. */
  private readonly returnBars = computed(() =>
    OrdersTableHelper.buildReturnBars(this.orders.rows(), new Date()),
  );

  protected daysOver(row: TradeRow): string {
    return OrdersTableHelper.daysOverText(row, new Date());
  }

  protected returnBar(row: TradeRow): ReturnBar | undefined {
    return this.returnBars().get(row.id);
  }

  /** Shows the popover over a cell, on hover, keyboard focus, or tap (touch has no hover). */
  protected showPopover(event: Event, details: ReturnDetails): void {
    this.popovers.show(event.currentTarget as HTMLElement, ReturnPopoverComponent, { details });
  }

  protected hidePopover(): void {
    this.popovers.hide();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!(event.target as Element).closest('.statistics')) {
      this.hidePopover();
    }
  }

  protected toggleNotSoldFilter(): void {
    this.onlyNotSold.update((on) => !on);
  }

  protected onRowKeyDown({ event, row }: RowEvent<TradeRow, KeyboardEvent>): void {
    if (event.key === 'Enter') {
      this.onRowEnter(event, row);
    }
  }

  /** Enter in any field of the row being edited finishes the edit, like the check mark button. */
  protected onRowEnter(event: Event, row: TradeRow): void {
    if (!row.editing || !(event.target as Element).closest('input')) {
      return;
    }
    this.orders.finishEdit(row);
  }

  /**
   * Stops a double click on a read-only row from selecting the word under the cursor. Single clicks
   * must be left alone: cancelling them would stop inputs from getting focus.
   * (A method, not an inline `a && b && preventDefault()`: Angular cancels the event when a handler
   * expression evaluates to `false`.)
   */
  protected onRowMouseDown(event: MouseEvent, editing: boolean): void {
    if (event.detail > 1 && !editing) {
      event.preventDefault();
    }
  }

  /** Double-click on a row (mouse) makes it editable. Clicks on buttons and inputs are left alone. */
  protected onRowDoubleClick(event: Event, id: number): void {
    if (!(event.target as Element).closest('button, input, select')) {
      this.orders.startEdit(id);
    }
  }

  private lastTap: { id: number; time: number } | null = null;

  /**
   * Double-tap on a row (touch) makes it editable. Detected by hand because browsers differ on
   * `dblclick` for touch (iOS Safari does not fire it, and a double tap normally zooms).
   */
  protected onRowPointerUp(event: PointerEvent, id: number): void {
    if (
      event.pointerType !== 'touch' ||
      (event.target as Element).closest('button, input, select')
    ) {
      return;
    }
    const now = Date.now();
    if (this.lastTap?.id === id && now - this.lastTap.time < DOUBLE_TAP_MS) {
      this.lastTap = null;
      this.orders.startEdit(id);
    } else {
      this.lastTap = { id, time: now };
    }
  }

  protected normalizeDate(row: TradeRow, field: 'buyDate' | 'sellDate'): void {
    row[field] = normalizeDateText(row[field]);
  }

  /** Opens the browser's calendar, starting on the date typed so far. `picker` is the hidden date input. */
  protected openCalendar(picker: HTMLInputElement, text: string): void {
    const date = parseDate(text);
    picker.value = date ? toIsoDate(date) : '';
    try {
      picker.showPicker();
    } catch {
      // Not supported by this browser; the date can still be typed.
    }
  }

  /** Writes the date chosen in the calendar back into the row, as dd-MMM-yyyy. */
  protected pickDate(row: TradeRow, field: 'buyDate' | 'sellDate', picker: HTMLInputElement): void {
    const date = parseIsoDate(picker.value);
    if (date) {
      row[field] = formatDate(date);
    }
  }
}
