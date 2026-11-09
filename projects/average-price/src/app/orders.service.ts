import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  describeGithubSaveError,
  GithubCommitService,
  GithubReadService,
  GithubTokenService,
} from '@my-utility/shared';
import { catchError, of, switchMap, throwError } from 'rxjs';
import { normalizeDateText } from './date-format';
import { OrderRecord, SYMBOLS, toRecord, TradeRow } from './trade-row';
import {
  canAddYear,
  INDEX_FILE,
  nextYearAfter,
  pickYear,
  yearFile,
  yearsOf,
  YearsIndex,
} from './years';

/**
 * The orders of the app and everything that happens to them as a whole: loading them from GitHub,
 * saving them back, adding, editing and deleting rows. The orders are kept in one file per year; the
 * year on screen is `selectedYear`. The toolbar and the table both use it, so they
 * always agree on what is on screen and whether it is saved. They never need to know about each other.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly reader = inject(GithubReadService);
  private readonly committer = inject(GithubCommitService);
  private readonly tokens = inject(GithubTokenService);
  private readonly destroyRef = inject(DestroyRef);
  private nextId = 1;

  /** The years that have a file (from the index), oldest first. */
  readonly years = signal<number[]>([]);

  /** The year whose orders are on screen. Null until the index has been read. */
  readonly selectedYear = signal<number | null>(null);

  /** The year the "Create … file" button would add: the one after the latest. */
  readonly nextYear = computed(() => nextYearAfter(this.years(), new Date().getFullYear()));

  /** The years for the dropdown: newest first. */
  readonly yearOptions = computed(() => [...this.years()].reverse());

  /** False once the file of next year exists: no further year can be added yet. */
  readonly canAddYear = computed(() => canAddYear(this.years(), new Date().getFullYear()));

  /** True while the file of a new year is being created. */
  readonly creatingYear = signal(false);

  /** The orders, loaded from the data repo on GitHub (empty until they have arrived). */
  readonly rows = signal<TradeRow[]>([]);

  /** True when a GitHub token was accepted, so the orders can be saved. */
  readonly canWrite = this.tokens.canWrite;

  /** The orders as last loaded or saved, to tell whether there are unsaved changes. */
  private readonly savedJson = signal('');

  /**
   * True when the orders differ from the last loaded or saved copy. It is worked out when the list of
   * rows changes, e.g. when a row is marked Done, so it does not follow every keystroke.
   */
  readonly unsaved = computed(() => JSON.stringify(this.rows().map(toRecord)) !== this.savedJson());

  readonly saving = signal(false);

  /** The result of the last save: shown next to the Save button. */
  private readonly saveResult = signal<{ ok: boolean; text: string } | null>(null);

  /** What the status line says, and whether it is an error. */
  readonly status = computed(() => {
    const result = this.saveResult();
    if (this.saving()) {
      return { error: false, text: 'Saving…' };
    }
    if (result && !result.ok) {
      return { error: true, text: result.text };
    }
    if (this.reader.source() === 'unavailable') {
      return { error: true, text: 'Server is busy right now. Please try again in a moment.' };
    }
    if (this.tokens.rejected()) {
      return {
        error: true,
        text: 'Your GitHub token is no longer accepted (expired or removed). View only: add a new token with the key button.',
      };
    }
    if (!this.tokens.canWrite()) {
      return { error: false, text: 'View only' };
    }
    if (this.unsaved()) {
      return { error: false, text: 'Unsaved changes' };
    }
    return { error: false, text: result ? result.text : 'All changes saved' };
  });

  constructor() {
    this.reload();
  }

  /**
   * Reads the index of years, then the orders of the year to show (the one on screen if it still
   * exists, else this year, else the latest). Also called later, from button clicks, so it gives
   * `takeUntilDestroyed` the `DestroyRef` explicitly: without it Angular only allows the call while
   * the service is being constructed.
   */
  reload(): void {
    this.reader
      .load<YearsIndex | null>(INDEX_FILE, null)
      .pipe(
        switchMap((index) => {
          const years = yearsOf(index);
          const year = pickYear(years, new Date().getFullYear(), this.selectedYear());
          this.years.set(years);
          this.selectedYear.set(year);
          return year === null
            ? of<OrderRecord[]>([])
            : this.reader.load<OrderRecord[]>(yearFile(year), []);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((orders) => this.showOrders(orders));
  }

  /**
   * Shows the orders of another year. Returns false, and changes nothing, if there are unsaved changes
   * and the user chose to keep them.
   */
  selectYear(year: number): boolean {
    if (year === this.selectedYear()) {
      return true;
    }
    if (
      this.unsaved() &&
      !window.confirm('You have unsaved changes. Switch year and discard them?')
    ) {
      return false;
    }
    this.selectedYear.set(year);
    this.reader
      .load<OrderRecord[]>(yearFile(year), [])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orders) => {
        // Ignore a slow answer for a year the user has already moved away from.
        if (this.selectedYear() === year) {
          this.showOrders(orders);
        }
      });
    return true;
  }

  /** Puts freshly loaded orders on screen; nothing is unsaved at that point. */
  private showOrders(orders: OrderRecord[]): void {
    this.nextId = Math.max(0, ...orders.map((order) => order.id)) + 1;
    this.rows.set(orders.map((order) => ({ ...order, editing: false })));
    this.savedJson.set(JSON.stringify(this.rows().map(toRecord)));
    this.saveResult.set(null);
  }

  /** Commits the orders of the year on screen to the data repo on GitHub. Only possible with the owner's token. */
  save(): void {
    const year = this.selectedYear();
    if (year === null) {
      return;
    }
    const records = this.rows().map(toRecord);
    this.saving.set(true);
    this.saveResult.set(null);
    this.committer.save(yearFile(year), records).subscribe({
      next: () => {
        this.savedJson.set(JSON.stringify(records));
        this.saving.set(false);
        this.saveResult.set({ ok: true, text: 'Saved to GitHub' });
      },
      error: (error: unknown) => this.failed(error, () => this.saving.set(false)),
    });
  }

  /**
   * Creates the file of the next year (empty), adds the year to the index, and switches to it. Only
   * possible with the owner's token.
   */
  createNextYear(): void {
    if (this.creatingYear() || !this.tokens.canWrite() || !this.canAddYear()) {
      return;
    }
    if (
      this.unsaved() &&
      !window.confirm('You have unsaved changes. Create the new year and discard them?')
    ) {
      return;
    }
    const year = this.nextYear();
    const years = [...this.years(), year];
    this.creatingYear.set(true);
    this.saveResult.set(null);
    this.committer
      .create(yearFile(year), [])
      .pipe(
        // The file may already be there from an earlier try that stopped before the index was updated.
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 422
            ? of(undefined)
            : throwError(() => error),
        ),
        switchMap(() => {
          const index: YearsIndex = { years };
          return this.reader.version(INDEX_FILE)
            ? this.committer.save(INDEX_FILE, index)
            : this.committer.create(INDEX_FILE, index);
        }),
      )
      .subscribe({
        next: () => {
          this.creatingYear.set(false);
          this.years.set(years);
          this.selectedYear.set(year);
          this.showOrders([]);
          this.saveResult.set({ ok: true, text: `Created ${yearFile(year)}` });
        },
        error: (error: unknown) => this.failed(error, () => this.creatingYear.set(false)),
      });
  }

  /** Shows why a write to GitHub failed, in words the owner can act on. */
  private failed(error: unknown, done: () => void): void {
    done();
    this.saveResult.set({
      ok: false,
      text: describeGithubSaveError(error, this.reader.config.repo),
    });
  }

  /** Adds an empty order at the top, ready to be filled in. */
  addOrder(): void {
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

  /** Switches a row between read-only and editable. */
  toggleEdit(id: number): void {
    this.rows.update((rows) => rows.map((r) => (r.id === id ? { ...r, editing: !r.editing } : r)));
  }

  /** Makes a row editable. Unlike `toggleEdit` it does nothing for a row that is already being edited. */
  startEdit(id: number): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.id === id && !r.editing ? { ...r, editing: true } : r)),
    );
  }

  /** Finishes editing a row. The typed dates are tidied first, e.g. `5-jan-2026` becomes `05-Jan-2026`. */
  finishEdit(row: TradeRow): void {
    // Done here, not left to the fields' blur event: the fields are removed from the page when the
    // row stops editing, so they may never get one.
    row.buyDate = normalizeDateText(row.buyDate);
    row.sellDate = normalizeDateText(row.sellDate);
    this.rows.update((rows) => rows.map((r) => (r.id === row.id ? { ...r, editing: false } : r)));
  }

  deleteRow(id: number): void {
    this.rows.update((rows) => rows.filter((r) => r.id !== id));
  }
}
