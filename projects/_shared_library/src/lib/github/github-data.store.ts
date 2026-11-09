import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { GITHUB_DATA_CONFIG } from './github-data.config';

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
 * Loads one JSON file from a GitHub repo and saves it back as a commit. Which file is set once, with
 * `provideGithubData(...)`.
 *
 * - Without a token, anyone can read the data (the repo is public). Saving is not possible.
 * - With the owner's token (kept only in this browser), the data is read through the GitHub API and
 *   can be saved as a commit to the repo.
 * - If GitHub cannot be reached, no data is shown and saving is switched off.
 */
@Injectable({ providedIn: 'root' })
export class GithubDataStore {
  private readonly http = inject(HttpClient);

  /** Which file this store reads and writes. */
  readonly config = inject(GITHUB_DATA_CONFIG);

  /** GitHub API address of the file: used with the token, for fresh reads and for saving. */
  private readonly apiUrl = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.path}`;
  /** Used only to test that a token can write (see `connect`). */
  private readonly blobUrl = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/git/blobs`;
  /** Public address of the file: what visitors read, no token needed (GitHub caches it for a few minutes). */
  private readonly publicUrl = `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${this.config.branch}/${this.config.path}`;

  /**
   * The version id of the file as last read or written. GitHub only accepts a save that quotes the
   * current version, which is how it notices that the file was changed by someone else meanwhile.
   */
  private sha: string | null = null;

  /** The owner's GitHub token, if one was entered in this browser. */
  readonly token = signal<string | null>(readStoredToken());

  /** Where the data on screen came from. */
  readonly source = signal<'github' | 'unavailable' | null>(null);

  /** True when the data was read with a token, so saving is possible. */
  readonly canWrite = signal(false);

  /**
   * True when a saved token was refused by GitHub (expired, deleted, or lacking access). The data is
   * then read publicly instead, view only, until a new token is added.
   */
  readonly tokenRejected = signal(false);

  /**
   * Reads the data: with the token if there is one; if GitHub refuses that token, publicly instead.
   * If GitHub cannot be reached at all, the result is `unavailableValue` and `source` says
   * `unavailable`.
   */
  load<T>(unavailableValue: T): Observable<T> {
    const token = this.token();
    const withToken = (token: string) =>
      this.readWithToken<T>(token).pipe(
        tap(() => this.tokenRejected.set(false)),
        catchError((error: unknown) => {
          const status = error instanceof HttpErrorResponse ? error.status : -1;
          this.tokenRejected.set(status === 401 || status === 403 || status === 404);
          return this.readPublic<T>();
        }),
      );
    const remote = token ? withToken(token) : this.readPublic<T>();
    return remote.pipe(catchError(() => this.unavailable(unavailableValue)));
  }

  /**
   * Checks a token and keeps it only if it works. Reading proves nothing on a public repo (any token
   * can read), so it also checks that the token can WRITE: it asks GitHub to store a tiny empty
   * object, which makes no commit and changes nothing visible. A read-only token fails with HTTP 403.
   */
  connect(token: string): Observable<unknown> {
    return this.fetchFile<unknown>(token).pipe(
      switchMap((data) =>
        this.http
          .post(
            this.blobUrl,
            { content: 'write access check', encoding: 'utf-8' },
            { headers: this.headers(token) },
          )
          .pipe(map(() => data)),
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

  /** Forgets the token. The caller should load the data again. */
  disconnect(): void {
    storeToken(null);
    this.token.set(null);
    this.tokenRejected.set(false);
    this.canWrite.set(false);
    this.sha = null;
  }

  /** Commits the data to the repo. Fails with HTTP 409/422 if the file changed on GitHub meanwhile. */
  save(data: unknown): Observable<void> {
    const token = this.token();
    if (!token || !this.sha) {
      return throwError(() => new Error('Not connected to GitHub'));
    }
    const body = {
      message: this.config.commitMessage ?? 'Update data from my-utility-app',
      content: encodeBase64(JSON.stringify(data, null, 2) + '\n'),
      sha: this.sha,
      branch: this.config.branch,
    };
    return this.http
      .put<{ content: { sha: string } }>(this.apiUrl, body, { headers: this.headers(token) })
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
  private readWithToken<T>(token: string): Observable<T> {
    return this.fetchFile<T>(token).pipe(
      tap(() => {
        this.source.set('github');
        this.canWrite.set(true);
      }),
    );
  }

  /** Reads the file through the API and remembers its version id for the next save. */
  private fetchFile<T>(token: string): Observable<T> {
    // The time in the address stops the browser from showing a copy of the file that is a minute old.
    const params = { ref: this.config.branch, t: Date.now() };
    return this.http.get<GithubFile>(this.apiUrl, { headers: this.headers(token), params }).pipe(
      map((file) => {
        if (!file.content) {
          throw new Error('The file is too large to read through the API');
        }
        this.sha = file.sha;
        return JSON.parse(decodeBase64(file.content)) as T;
      }),
    );
  }

  private readPublic<T>(): Observable<T> {
    return this.http.get<T>(this.publicUrl).pipe(
      tap(() => {
        this.sha = null;
        this.source.set('github');
        this.canWrite.set(false);
      }),
    );
  }

  /** GitHub could not be reached: nothing to show, and nothing that could be saved. */
  private unavailable<T>(value: T): Observable<T> {
    this.sha = null;
    this.source.set('unavailable');
    this.canWrite.set(false);
    return of(value);
  }
}
