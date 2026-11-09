import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { OrderRecord } from './trade-row';

// The data lives in its own public repo: anyone can read it, only the owner's token can change it.
const OWNER = 'svmonedrive';
const REPO = 'my-utility-app-data';
const BRANCH = 'main';
/**
 * The data repo keeps one folder per app, named `<app-name>-app-data`. Another app (say `xyz`) would
 * use `xyz-app-data/<its file>` in the same way.
 */
const DATA_FOLDER = 'average-price-app-data';
const FILE = `${DATA_FOLDER}/orders.json`;

/** GitHub API address of the file: used with the owner's token, for fresh reads and for saving. */
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`;
/** Used only to test that a token can write (see `connect`). */
const BLOB_URL = `https://api.github.com/repos/${OWNER}/${REPO}/git/blobs`;
/** Public address of the file: what visitors read, no token needed (GitHub caches it for a few minutes). */
const PUBLIC_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FILE}`;

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

const encodeBase64 = (text: string): string => {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const decodeBase64 = (base64: string): string => {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
};

interface GithubFile {
  content: string;
  sha: string;
}

/**
 * Loads the orders from the data repo and saves them back.
 *
 * - Without a token, anyone can read the orders. Saving is not possible.
 * - With the owner's token (kept only in this browser), the orders are read through the GitHub API and
 *   can be saved as a commit to the data repo.
 * - If GitHub cannot be reached, no orders are shown and saving is switched off.
 */
@Injectable({ providedIn: 'root' })
export class OrdersStore {
  private readonly http = inject(HttpClient);

  /**
   * The version id of the file as last read or written. GitHub only accepts a save that quotes the
   * current version, which is how it notices that the file was changed by someone else meanwhile.
   */
  private sha: string | null = null;

  /** The owner's GitHub token, if one was entered in this browser. */
  readonly token = signal<string | null>(readStoredToken());

  /** Where the orders on screen came from. */
  readonly source = signal<'github' | 'unavailable' | null>(null);

  /** True when the orders were read with a token, so saving is possible. */
  readonly canWrite = signal(false);

  /**
   * True when a saved token was refused by GitHub (expired, deleted, or lacking access). The orders are
   * then read publicly instead, view only, until a new token is added.
   */
  readonly tokenRejected = signal(false);

  /**
   * Reads the orders: with the token if there is one; if GitHub refuses that token, publicly instead.
   * If GitHub cannot be reached at all, the result is an empty list and `source` says `unavailable`.
   */
  load(): Observable<OrderRecord[]> {
    const token = this.token();
    const withToken = (token: string) =>
      this.readWithToken(token).pipe(
        tap(() => this.tokenRejected.set(false)),
        catchError((error: unknown) => {
          const status = error instanceof HttpErrorResponse ? error.status : -1;
          this.tokenRejected.set(status === 401 || status === 403 || status === 404);
          return this.readPublic();
        }),
      );
    const remote = token ? withToken(token) : this.readPublic();
    return remote.pipe(catchError(() => this.unavailable()));
  }

  /**
   * Checks a token and keeps it only if it works. Reading proves nothing on a public repo (any token
   * can read), so it also checks that the token can WRITE: it asks GitHub to store a tiny empty
   * object, which makes no commit and changes nothing visible. A read-only token fails with HTTP 403.
   */
  connect(token: string): Observable<OrderRecord[]> {
    return this.fetchFile(token).pipe(
      switchMap((orders) =>
        this.http
          .post(
            BLOB_URL,
            { content: 'write access check', encoding: 'utf-8' },
            { headers: this.headers(token) },
          )
          .pipe(map(() => orders)),
      ),
      tap(() => {
        storeToken(token);
        this.token.set(token);
        this.tokenRejected.set(false);
        this.source.set('github');
        this.canWrite.set(true);
      }),
    );
  }

  /** Forgets the token. The caller should load the orders again. */
  disconnect(): void {
    storeToken(null);
    this.token.set(null);
    this.tokenRejected.set(false);
    this.canWrite.set(false);
    this.sha = null;
  }

  /** Commits the orders to the data repo. Fails with HTTP 409/422 if the file changed on GitHub meanwhile. */
  save(orders: OrderRecord[]): Observable<void> {
    const token = this.token();
    if (!token || !this.sha) {
      return throwError(() => new Error('Not connected to GitHub'));
    }
    const body = {
      message: 'Update orders from my-utility-app',
      content: encodeBase64(JSON.stringify(orders, null, 2) + '\n'),
      sha: this.sha,
      branch: BRANCH,
    };
    return this.http
      .put<{ content: { sha: string } }>(API_URL, body, { headers: this.headers(token) })
      .pipe(
        tap((response) => (this.sha = response.content.sha)),
        map(() => undefined),
      );
  }

  private headers(token: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    });
  }

  /** Reads the file with the token; saving is assumed to work (a save that fails says why). */
  private readWithToken(token: string): Observable<OrderRecord[]> {
    return this.fetchFile(token).pipe(
      tap(() => {
        this.source.set('github');
        this.canWrite.set(true);
      }),
    );
  }

  /** Reads the file through the API and remembers its version id for the next save. */
  private fetchFile(token: string): Observable<OrderRecord[]> {
    // The time in the address stops the browser from showing a copy of the file that is a minute old.
    const params = { ref: BRANCH, t: Date.now() };
    return this.http.get<GithubFile>(API_URL, { headers: this.headers(token), params }).pipe(
      map((file) => {
        if (!file.content) {
          throw new Error('The orders file is too large to read through the API');
        }
        this.sha = file.sha;
        return JSON.parse(decodeBase64(file.content)) as OrderRecord[];
      }),
    );
  }

  private readPublic(): Observable<OrderRecord[]> {
    return this.http.get<OrderRecord[]>(PUBLIC_URL).pipe(
      tap(() => {
        this.sha = null;
        this.source.set('github');
        this.canWrite.set(false);
      }),
    );
  }

  /** GitHub could not be reached: nothing to show, and nothing that could be saved. */
  private unavailable(): Observable<OrderRecord[]> {
    this.sha = null;
    this.source.set('unavailable');
    this.canWrite.set(false);
    return of([]);
  }
}
