import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatDate, normalizeDateText, parseDate, parseIsoDate, toIsoDate } from '../date-format';
import { OrdersService } from '../orders.service';
import { ALL_SYMBOLS } from '../orders-table/orders-table';
import { OrdersTableHelper } from '../orders-table/orders-table.helper';
import { OrderFields, TradeRow } from '../trade-row';
import { MAX_SYMBOL_LENGTH, symbolProblem } from '../years';

/** What the dialog needs: the order to change, or null to enter a new one. */
export interface OrderDialogData {
  order: TradeRow | null;
}

/**
 * The form for one order, shown in a CDK dialog: symbol, buy date, price, quantity, sell date and price.
 * It closes with the entered values (`OrderFields`) when Save is pressed, and with nothing when it is
 * cancelled. The owner can also add a new symbol here: it is saved to the index file straight away and
 * then shows up in the dropdown.
 */
@Component({
  selector: 'app-order-dialog',
  imports: [FormsModule, CdkDrag, CdkDragHandle],
  styleUrl: './order-dialog.component.scss',
  templateUrl: './order-dialog.component.html',
})
export class OrderDialogComponent {
  private readonly dialogRef = inject<DialogRef<OrderFields | undefined>>(DialogRef);
  private readonly data = inject<OrderDialogData>(DIALOG_DATA);
  protected readonly orders = inject(OrdersService);

  protected readonly isNew = this.data.order === null;
  protected readonly isInvalidDate = OrdersTableHelper.isInvalidDate;
  protected readonly maxSymbolLength = MAX_SYMBOL_LENGTH;

  // The form values (the dialog works on copies: nothing changes in the table until Save).
  protected symbol = this.data.order?.symbol ?? this.orders.symbols()[0] ?? '';
  protected buyDate = this.data.order?.buyDate ?? '';
  protected buyPrice = this.data.order?.buyPrice ?? null;
  protected quantity = this.data.order?.quantity ?? null;
  protected sellDate = this.data.order?.sellDate ?? '';
  protected sellPrice = this.data.order?.sellPrice ?? null;

  /** The symbol of the order being changed, if the index does not list it (so the dropdown can still show it). */
  private readonly ownSymbol = signal(this.data.order?.symbol ?? '');

  /** The dropdown options: every symbol of the index. */
  protected readonly symbolOptions = computed(() => {
    const list = this.orders.symbols();
    const own = this.ownSymbol();
    return own && !list.includes(own) ? [...list, own] : list;
  });

  protected readonly error = signal('');

  // Adding a symbol
  protected readonly addingSymbol = signal(false);
  protected readonly savingSymbol = signal(false);
  protected readonly symbolError = signal('');
  protected newSymbol = '';

  protected showNewSymbol(): void {
    this.newSymbol = '';
    this.symbolError.set('');
    this.addingSymbol.set(true);
  }

  protected cancelNewSymbol(event?: Event): void {
    // Escape here only closes the small input, not the whole dialog.
    event?.stopPropagation();
    this.addingSymbol.set(false);
  }

  protected onNewSymbolEnter(event: Event): void {
    // Enter here saves the symbol; it must not submit the whole form.
    event.preventDefault();
    this.saveNewSymbol();
  }

  /** Saves the typed symbol to the index file, then selects it in the dropdown. */
  protected saveNewSymbol(): void {
    if (this.savingSymbol()) {
      return;
    }
    const name = this.newSymbol.trim().replace(/\s+/g, ' ');
    const problem = symbolProblem(name, this.symbolOptions(), ALL_SYMBOLS);
    if (problem) {
      this.symbolError.set(problem);
      return;
    }
    this.savingSymbol.set(true);
    this.symbolError.set('');
    this.orders.addSymbol(name).subscribe({
      next: () => {
        this.symbol = name;
        this.savingSymbol.set(false);
        this.addingSymbol.set(false);
      },
      error: (error: unknown) => {
        this.savingSymbol.set(false);
        this.symbolError.set(this.orders.describeError(error));
      },
    });
  }

  protected normalizeDate(field: 'buyDate' | 'sellDate'): void {
    this[field] = normalizeDateText(this[field]);
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

  /** Writes the date chosen in the calendar back into the field, as dd-MMM-yyyy. */
  protected pickDate(field: 'buyDate' | 'sellDate', picker: HTMLInputElement): void {
    const date = parseIsoDate(picker.value);
    if (date) {
      this[field] = formatDate(date);
    }
  }

  protected save(): void {
    const buyDate = normalizeDateText(this.buyDate.trim());
    const sellDate = normalizeDateText(this.sellDate.trim());
    const problem = this.problem(buyDate, sellDate);
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.dialogRef.close({
      symbol: this.symbol,
      buyDate,
      buyPrice: this.buyPrice,
      quantity: this.quantity,
      sellDate,
      sellPrice: sellDate ? this.sellPrice : null,
    });
  }

  protected cancel(): void {
    this.dialogRef.close();
  }

  /** What is wrong with the entered values, in words; empty if they are fine. */
  private problem(buyDate: string, sellDate: string): string {
    if (!this.symbol) {
      return 'Choose a symbol. If the list is empty, the owner can add one with the Add button.';
    }
    const bought = parseDate(buyDate);
    if (!bought) {
      return 'Enter the buy date like 20-Jan-2026.';
    }
    if (!this.buyPrice || this.buyPrice <= 0) {
      return 'Enter the buy price.';
    }
    if (!this.quantity || this.quantity <= 0) {
      return 'Enter the quantity.';
    }
    if (!sellDate && this.sellPrice === null) {
      return ''; // not sold yet
    }
    const sold = parseDate(sellDate);
    if (!sold) {
      return 'Enter the sell date like 20-Jan-2026, or clear the sell price if it is not sold yet.';
    }
    if (!this.sellPrice || this.sellPrice <= 0) {
      return 'Enter the sell price, or clear the sell date if it is not sold yet.';
    }
    if (sold < bought) {
      return 'The sell date is before the buy date.';
    }
    return '';
  }
}
