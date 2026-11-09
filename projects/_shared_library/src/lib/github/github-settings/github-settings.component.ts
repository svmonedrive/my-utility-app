import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GithubDataStore } from '../github-data.store';

/**
 * A key button that opens a small dialog for the owner's GitHub token. A token is only needed to save
 * changes; everybody can view the data without one. Uses the file set with `provideGithubData(...)`.
 */
@Component({
  selector: 'lib-github-settings',
  imports: [FormsModule],
  templateUrl: './github-settings.component.html',
  styleUrl: './github-settings.component.scss',
})
export class GithubSettingsComponent {
  protected readonly store = inject(GithubDataStore);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** Emits after a token was accepted: the data should be read again, now with the token. */
  readonly connected = output<void>();
  /** Emits after the token was removed: the data should be read again, now without it. */
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
      next: () => {
        this.checking.set(false);
        this.connected.emit();
        this.close();
      },
      error: (error: unknown) => {
        this.checking.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : -1;
        this.error.set(
          status === 403
            ? `This token can read the repository but not write to it. In the token settings, choose "Only select repositories" with ${this.store.config.repo}, and set Contents to "Read and write".`
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
