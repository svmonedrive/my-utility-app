import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  describeGithubSaveError,
  GithubCommitService,
  GithubReadService,
  GithubTokenService,
} from '@my-utility/shared';
import { normalizeDateText } from './date-format';
import { OrderRecord, SYMBOLS, toRecord, TradeRow } from './trade-row';

/**
 * The orders of the app and everything that happens to them as a whole: loading them from GitHub,
 * saving them back, adding, editing and deleting rows. The toolbar and the table both use it, so they
 * always agree on what is on screen and whether it is saved. They never need to know about each other.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly reader = inject(GithubReadService);
  private readonly committer = inject(GithubCommitService);
  private readonly tokens = inject(GithubTokenService);
  private readonly destroyRef = inject(DestroyRef);
  private nextId = 1;

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
   * Reads the orders from GitHub (with the token if there is one) and shows them. Also called later,
   * from button clicks, so it gives `takeUntilDestroyed` the `DestroyRef` explicitly: without it Angular
   * only allows the call while the service is being constructed.
   */
  reload(): void {
    this.reader
      .load<OrderRecord[]>([])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orders) => this.showOrders(orders));
  }

  /** Puts freshly loaded orders on screen; nothing is unsaved at that point. */
  private showOrders(orders: OrderRecord[]): void {
    this.nextId = Math.max(0, ...orders.map((order) => order.id)) + 1;
    this.rows.set(orders.map((order) => ({ ...order, editing: false })));
    this.savedJson.set(JSON.stringify(this.rows().map(toRecord)));
    this.saveResult.set(null);
  }

  /** Commits the orders to the data repo on GitHub. Only possible with the owner's token. */
  save(): void {
    const records = this.rows().map(toRecord);
    this.saving.set(true);
    this.saveResult.set(null);
    this.committer.save(records).subscribe({
      next: () => {
        this.savedJson.set(JSON.stringify(records));
        this.saving.set(false);
        this.saveResult.set({ ok: true, text: 'Saved to GitHub' });
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.saveResult.set({
          ok: false,
          text: describeGithubSaveError(error, this.reader.config.repo),
        });
      },
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
