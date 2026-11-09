import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { formatDate, parseDate, parseIsoDate, toIsoDate } from '../date-format';
import { GithubSettingsComponent } from '../github-settings/github-settings.component';
import { formatPriceCell } from '../money';
import { OrdersStore } from '../orders-store.service';
import { calcPendingReturns, calcReturns, daysHeld, daysSinceBuy, isSold } from '../returns';
import { OrderRecord, SYMBOLS, toRecord, TradeRow, TradeSymbol } from '../trade-row';
import { describePending, describeReturns, ReturnDetails } from '../return-popover/return-details';
import { ReturnPopoverComponent } from '../return-popover/return-popover.component';

/** What a failed save means, in words the owner can act on. */
function describeSaveError(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : -1;
  if (status === 409 || status === 422) {
    return 'The data on GitHub changed since you opened this page. Reload the page, then make your change again.';
  }
  if (status === 403) {
    return 'GitHub refused the save: the token can read but not write. In the token settings, choose "Only select repositories" with my-utility-app-data, and set Contents to "Read and write". Then remove and add the token again.';
  }
  if (status === 401 || status === 404) {
    return 'GitHub did not accept the token. It may have expired, or been deleted. Add a new token with the key button.';
  }
  if (status === 0) {
    return 'Could not reach GitHub. Check your connection and try again.';
  }
  return 'Saving failed. Try again.';
}

/** The Symbol filter's "no filtering" choice. */
const ALL_SYMBOLS = 'All';
type SymbolFilter = typeof ALL_SYMBOLS | TradeSymbol;

/** Two taps on the same row within this many milliseconds count as a double tap. */
const DOUBLE_TAP_MS = 350;

interface ReturnBar {
  /**
   * Bar widths in percent of the cell. For a sold order the larger of the two returns fills the
   * cell and the other is its ratio. For an order not sold yet both are full width.
   */
  actualWidth: number;
  bankWidth: number;
  details: ReturnDetails;
}

interface PopoverState {
  details: ReturnDetails;
  /** Viewport x (px) of the centre of the cell the popover points at. */
  anchorX: number;
  top: number;
  below: boolean;
}

@Component({
  selector: 'app-orders-table',
  imports: [FormsModule, GithubSettingsComponent, ReturnPopoverComponent],
  styleUrl: './orders-table.component.scss',
  templateUrl: './orders-table.component.html',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'hidePopover()',
  },
})
export class OrdersTableComponent {
  private nextId = 1;
  protected readonly store = inject(OrdersStore);

  /** The orders, loaded from the data repo on GitHub (empty until they have arrived). */
  protected readonly rows = signal<TradeRow[]>([]);

  /** The orders as last loaded or saved, to tell whether there are unsaved changes. */
  private readonly savedJson = signal('');

  /**
   * True when the orders differ from the last loaded or saved copy. It is worked out when the list of
   * rows changes, e.g. when a row is marked Done, so it does not follow every keystroke.
   */
  protected readonly unsaved = computed(
    () => JSON.stringify(this.rows().map(toRecord)) !== this.savedJson(),
  );

  protected readonly saving = signal(false);

  /** The result of the last save: shown next to the Save button. */
  protected readonly saveResult = signal<{ ok: boolean; text: string } | null>(null);

  /** What the line next to the Save button says. */
  protected readonly status = computed(() => {
    const result = this.saveResult();
    if (this.saving()) {
      return { error: false, text: 'Saving…' };
    }
    if (result && !result.ok) {
      return { error: true, text: result.text };
    }
    if (this.store.source() === 'unavailable') {
      return {
        error: true,
        text: 'Server is busy right now. Please try again in a moment.',
      };
    }
    if (this.store.tokenRejected()) {
      return {
        error: true,
        text: 'Your GitHub token is no longer accepted (expired or removed). View only: add a new token with the key button.',
      };
    }
    if (!this.store.canWrite()) {
      return { error: false, text: 'View only' };
    }
    if (this.unsaved()) {
      return { error: false, text: 'Unsaved changes' };
    }
    return { error: false, text: result ? result.text : 'All changes saved' };
  });

  /** When on, only the orders that are not sold yet are listed. */
  protected readonly onlyNotSold = signal(false);

  /** The Symbol filter in the column header: one symbol, or `All` for no filtering. */
  protected readonly symbolFilter = signal<SymbolFilter>(ALL_SYMBOLS);

  /**
   * The rows to list: the "Holding" filter and the Symbol filter both apply. Recomputed when the rows
   * list changes, so a row being edited stays in the list until it is marked Done, even if it just
   * got a sell price or a different symbol.
   */
  protected readonly visibleRows = computed(() => {
    const symbol = this.symbolFilter();
    const onlyNotSold = this.onlyNotSold();
    return this.rows().filter(
      (row) => (symbol === ALL_SYMBOLS || row.symbol === symbol) && (!onlyNotSold || !isSold(row)),
    );
  });
  protected readonly priceCell = formatPriceCell;
  protected readonly symbols = SYMBOLS;
  protected readonly allSymbols = ALL_SYMBOLS;
  protected readonly popover = signal<PopoverState | null>(null);

  /** Recomputed when the rows list changes, e.g. when a row is marked Done. */
  private readonly returnBars = computed(() => {
    const bars = new Map<number, ReturnBar>();
    const today = new Date();
    for (const row of this.rows()) {
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
  });

  constructor() {
    this.reload();
  }

  /** Reads the orders from GitHub (with the token if there is one) and shows them. */
  protected reload(): void {
    this.store
      .load()
      .pipe(takeUntilDestroyed())
      .subscribe((orders) => this.showOrders(orders));
  }

  /** Puts freshly loaded orders on screen; nothing is unsaved at that point. */
  protected showOrders(orders: OrderRecord[]): void {
    this.nextId = Math.max(0, ...orders.map((order) => order.id)) + 1;
    this.rows.set(orders.map((order) => ({ ...order, editing: false })));
    this.savedJson.set(JSON.stringify(this.rows().map(toRecord)));
    this.saveResult.set(null);
  }

  /** Commits the orders to the data repo on GitHub. Only possible with the owner's token. */
  protected save(): void {
    const records = this.rows().map(toRecord);
    this.saving.set(true);
    this.saveResult.set(null);
    this.store.save(records).subscribe({
      next: () => {
        this.savedJson.set(JSON.stringify(records));
        this.saving.set(false);
        this.saveResult.set({ ok: true, text: 'Saved to GitHub' });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.saveResult.set({ ok: false, text: describeSaveError(error) });
      },
    });
  }

  /**
   * While there is no sell date: how long the order has been open, e.g. "(34 days over)".
   * Goes away as soon as a sell date is entered, even if the sell price is still missing.
   */
  protected daysOver(row: TradeRow): string {
    const days = row.sellDate.trim() === '' ? daysSinceBuy(row, new Date()) : null;
    return days === null ? '' : `(${days} ${days === 1 ? 'day' : 'days'} over)`;
  }

  /** Once there is a sell date: how long the order was held, e.g. "(23 days)", under the date. */
  protected daysHeldText(row: TradeRow): string {
    const days = daysHeld(row);
    return days === null ? '' : `(${days} ${days === 1 ? 'day' : 'days'})`;
  }

  protected returnBar(row: TradeRow): ReturnBar | undefined {
    return this.returnBars().get(row.id);
  }

  /** Shows the popover over a cell, on hover, keyboard focus, or tap (touch has no hover). */
  protected showPopover(event: Event, details: ReturnDetails): void {
    const cell = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const below = cell.top < 220;
    this.popover.set({
      details,
      anchorX: cell.left + cell.width / 2,
      top: below ? cell.bottom + 8 : cell.top - 8,
      below,
    });
  }

  protected hidePopover(): void {
    this.popover.set(null);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!(event.target as Element).closest('.statistics')) {
      this.hidePopover();
    }
  }

  protected addOrder(): void {
    const empty: TradeRow = {
      id: this.nextId++,
      editing: true,
      symbol: SYMBOLS[0],
      buyDate: '',
      buyPrice: null,
      quantity: null,
      sellDate: '',
      sellPrice: null,
    };
    this.rows.update((rows) => [empty, ...rows]);
  }

  protected toggleNotSoldFilter(): void {
    this.onlyNotSold.update((on) => !on);
  }

  protected toggleEdit(id: number): void {
    this.rows.update((rows) => rows.map((r) => (r.id === id ? { ...r, editing: !r.editing } : r)));
  }

  /** Makes a row editable. Unlike toggleEdit it does nothing for a row that is already being edited. */
  private startEdit(id: number): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.id === id && !r.editing ? { ...r, editing: true } : r)),
    );
  }

  /** Enter in any field of the row being edited finishes the edit, like the check mark button. */
  protected onRowEnter(event: Event, row: TradeRow): void {
    if (!row.editing || !(event.target as Element).closest('input')) {
      return;
    }
    // Tidy the typed dates now: the fields are removed from the page when the row stops editing,
    // so they may never get a blur event to do it.
    this.normalizeDate(row, 'buyDate');
    this.normalizeDate(row, 'sellDate');
    this.rows.update((rows) => rows.map((r) => (r.id === row.id ? { ...r, editing: false } : r)));
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
      this.startEdit(id);
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
      this.startEdit(id);
    } else {
      this.lastTap = { id, time: now };
    }
  }

  protected normalizeDate(row: TradeRow, field: 'buyDate' | 'sellDate'): void {
    const date = parseDate(row[field]);
    if (date) {
      row[field] = formatDate(date);
    }
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

  /** CSS class for the row background, one per calendar month of the buy date (month-0 = Jan). */
  protected monthClass(buyDate: string): string {
    const date = parseDate(buyDate);
    return date ? `month-${date.getMonth()}` : '';
  }

  protected isInvalidDate(text: string): boolean {
    return text.trim() !== '' && parseDate(text) === null;
  }

  protected deleteRow(id: number): void {
    this.rows.update((rows) => rows.filter((r) => r.id !== id));
  }
}
