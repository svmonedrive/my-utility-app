import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OrdersStore } from '../orders-store.service';
import { OrderRecord } from '../trade-row';

/**
 * A gear button that opens a small dialog for the owner's GitHub token. A token is only needed to
 * save changes; everybody can view the orders without one.
 */
@Component({
  selector: 'app-github-settings',
  imports: [FormsModule],
  templateUrl: './github-settings.component.html',
  styleUrl: './github-settings.component.scss',
})
export class GithubSettingsComponent {
  protected readonly store = inject(OrdersStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Emits the orders read with a newly accepted token. */
  readonly connected = output<OrderRecord[]>();
  /** Emits after the token was removed; the orders should be read again without it. */
  readonly disconnected = output<void>();

  protected tokenText = '';
  protected readonly checking = signal(false);
  protected readonly error = signal('');

  protected open(): void {
    this.tokenText = '';
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected useToken(): void {
    const token = this.tokenText.trim();
    if (!token) {
      this.error.set('Paste your token first.');
      return;
    }
    this.checking.set(true);
    this.error.set('');
    this.store.connect(token).subscribe({
      next: (orders) => {
        this.checking.set(false);
        this.connected.emit(orders);
        this.close();
      },
      error: (error: unknown) => {
        this.checking.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : -1;
        this.error.set(
          status === 403
            ? 'This token can read the repository but not write to it. In the token settings, choose "Only select repositories" with my-utility-app-data, and set Contents to "Read and write".'
            : status === 0
              ? 'Could not reach GitHub. Check your connection and try again.'
              : 'GitHub did not accept this token. Check that it was copied completely and has not expired.',
        );
      },
    });
  }

  protected removeToken(): void {
    this.store.disconnect();
    this.disconnected.emit();
    this.close();
  }
}
