import { Dialog } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import {
  DataTableComponent,
  LibTdActionDirective,
  LibTdDirective,
  LibThActionDirective,
  PopoverService,
} from '@my-utility/shared';
import { formatPriceCell } from '../money';
import { OrdersFilterService } from '../orders-filter/orders-filter.service';
import { OrderDialogComponent, OrderDialogData } from '../order-dialog/order-dialog.component';
import { OrdersService } from '../orders.service';
import { OrderFields, TradeRow } from '../trade-row';
import { ReturnDetails } from '../return-popover/return-details';
import { ReturnPopoverComponent } from '../return-popover/return-popover.component';
import { DOUBLE_TAP_MS, ORDERS_COLUMNS, ReturnBar } from './orders-table';
import { OrdersTableHelper } from './orders-table.helper';

@Component({
  selector: 'app-orders-table',
  imports: [
    DataTableComponent,
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
  private readonly filter = inject(OrdersFilterService);
  private readonly popovers = inject(PopoverService);
  private readonly dialog = inject(Dialog);

  // What the template uses from the meta file (`orders-table.ts`), the helper class and elsewhere.
  protected readonly columns = ORDERS_COLUMNS;
  protected readonly trackById = OrdersTableHelper.trackById;
  protected readonly rowStyle = OrdersTableHelper.monthRowStyle;
  protected readonly daysHeldText = OrdersTableHelper.daysHeldText;
  protected readonly priceCell = formatPriceCell;

  /** The rows to list: the ones the toolbar's filters (symbol, month and "Holding") let through. */
  protected readonly visibleRows = this.filter.visibleRows;

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

  /**
   * Stops a double click on a row from selecting the word under the cursor. Single clicks must be
   * left alone. (A method, not an inline `a && preventDefault()`: Angular cancels the event when a
   * handler expression evaluates to `false`.)
   */
  protected onRowMouseDown(event: MouseEvent): void {
    if (event.detail > 1) {
      event.preventDefault();
    }
  }

  /** Double-click on a row (mouse) opens the order form. Clicks on buttons are left alone. */
  protected onRowDoubleClick(event: Event, row: TradeRow): void {
    if (!(event.target as Element).closest('button, input, select')) {
      this.openOrder(row);
    }
  }

  private lastTap: { id: number; time: number } | null = null;

  /**
   * Double-tap on a row (touch) opens the order form. Detected by hand because browsers differ on
   * `dblclick` for touch (iOS Safari does not fire it, and a double tap normally zooms).
   */
  protected onRowPointerUp(event: PointerEvent, row: TradeRow): void {
    if (
      event.pointerType !== 'touch' ||
      (event.target as Element).closest('button, input, select')
    ) {
      return;
    }
    const now = Date.now();
    if (this.lastTap?.id === row.id && now - this.lastTap.time < DOUBLE_TAP_MS) {
      this.lastTap = null;
      this.openOrder(row);
    } else {
      this.lastTap = { id: row.id, time: now };
    }
  }

  /** Opens the order form: for a new order (`row` null) or to change `row`. The table changes only on Save. */
  protected openOrder(row: TradeRow | null): void {
    if (this.dialog.openDialogs.length) {
      return;
    }
    this.hidePopover();
    const ref = this.dialog.open<OrderFields | undefined, OrderDialogData>(OrderDialogComponent, {
      data: { order: row },
      width: 'min(32rem, calc(100vw - 1rem))',
      maxWidth: '100vw',
      ariaLabel: row ? 'Edit order' : 'Add order',
    });
    ref.closed.subscribe((fields) => {
      if (!fields) {
        return;
      }
      if (row) {
        this.orders.updateOrder(row.id, fields);
      } else {
        this.orders.addOrder(fields);
      }
    });
  }
}
