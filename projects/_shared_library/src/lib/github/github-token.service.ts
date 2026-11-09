import { Injectable, signal } from '@angular/core';

/**
 * The token is kept under this name in the browser. It is the same for every app on the same site
 * address, so a token entered in one app works in the others too. (Do not rename it: tokens already
 * saved under this name would be lost.)
 */
const TOKEN_KEY = 'my-utility-app:github-token';

const readStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null; // storage blocked: the token then lasts only until the page is closed
  }
};

const storeToken = (token: string | null): void => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // storage blocked; nothing to do
  }
};

/**
 * The owner's GitHub token: where it is kept, and how GitHub has treated it so far. Reading and
 * committing both use it, so it is its own small service.
 */
@Injectable({ providedIn: 'root' })
export class GithubTokenService {
  /** The token entered in this browser, if any. */
  readonly token = signal<string | null>(readStoredToken());

  /**
   * True when a saved token was refused by GitHub (expired, deleted, or lacking access). The data is
   * then read publicly instead, view only, until a new token is added.
   */
  readonly rejected = signal(false);

  /** True when the data was read with a token that GitHub accepted, so saving is possible. */
  readonly canWrite = signal(false);

  /** Keeps a token that was checked and works. */
  accept(token: string): void {
    storeToken(token);
    this.token.set(token);
    this.rejected.set(false);
    this.canWrite.set(true);
  }

  /** Forgets the token. The caller should read the data again. */
  forget(): void {
    storeToken(null);
    this.token.set(null);
    this.rejected.set(false);
    this.canWrite.set(false);
  }
}
