import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { decodeBase64, GithubFile, githubHeaders, githubUrls } from './github-api';
import { GITHUB_DATA_CONFIG } from './github-data.config';
import { GithubTokenService } from './github-token.service';

/**
 * Reads the app's JSON file from its GitHub repo.
 *
 * - Without a token, anyone can read it (the repo is public).
 * - With the owner's token it is read through the GitHub API, which is always fresh and also tells us
 *   the file's version id, which a later save needs.
 * - If GitHub refuses the token, the file is read publicly instead (view only).
 * - If GitHub cannot be reached at all, `load` gives the value it was told to use and `source` says so.
 *
 * Which file is set once, with `provideGithubData(...)`. Saving is `GithubCommitService`'s job.
 */
@Injectable({ providedIn: 'root' })
export class GithubReadService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(GithubTokenService);

  /** Which file this service reads. */
  readonly config = inject(GITHUB_DATA_CONFIG);
  private readonly urls = githubUrls(this.config);

  /** Where the data on screen came from. */
  readonly source = signal<'github' | 'unavailable' | null>(null);

  private readonly versionId = signal<string | null>(null);

  /**
   * The version id of the file as last read or written. GitHub only accepts a save that quotes the
   * current version, which is how it notices that the file was changed by someone else meanwhile.
   * Null when the file was read publicly (no way to save then).
   */
  readonly version = this.versionId.asReadonly();

  /**
   * Reads the data: with the token if there is one; if GitHub refuses that token, publicly instead.
   * If GitHub cannot be reached at all, the result is `unavailableValue` and `source` says
   * `unavailable`.
   */
  load<T>(unavailableValue: T): Observable<T> {
    const token = this.tokens.token();
    const withToken = (token: string) =>
      this.fetchWithToken<T>(token).pipe(
        tap(() => {
          this.source.set('github');
          this.tokens.rejected.set(false);
          this.tokens.canWrite.set(true);
        }),
        catchError((error: unknown) => {
          const status = error instanceof HttpErrorResponse ? error.status : -1;
          this.tokens.rejected.set(status === 401 || status === 403 || status === 404);
          return this.readPublic<T>();
        }),
      );
    const remote = token ? withToken(token) : this.readPublic<T>();
    return remote.pipe(catchError(() => this.unavailable(unavailableValue)));
  }

  /** Reads the file through the API with a token, and remembers its version id. Changes nothing else. */
  fetchWithToken<T>(token: string): Observable<T> {
    // The time in the address stops the browser from showing a copy of the file that is a minute old.
    const params = { ref: this.config.branch, t: Date.now() };
    return this.http.get<GithubFile>(this.urls.api, { headers: githubHeaders(token), params }).pipe(
      map((file) => {
        if (!file.content) {
          throw new Error('The file is too large to read through the API');
        }
        this.versionId.set(file.sha);
        return JSON.parse(decodeBase64(file.content)) as T;
      }),
    );
  }

  /** Called after a successful save: the file now has a new version id. */
  rememberVersion(versionId: string): void {
    this.versionId.set(versionId);
  }

  /** Called when a working token was just added: GitHub is clearly reachable. */
  markReachable(): void {
    this.source.set('github');
  }

  private readPublic<T>(): Observable<T> {
    return this.http.get<T>(this.urls.public).pipe(
      tap(() => {
        this.versionId.set(null);
        this.source.set('github');
        this.tokens.canWrite.set(false);
      }),
    );
  }

  /** GitHub could not be reached: nothing to show, and nothing that could be saved. */
  private unavailable<T>(value: T): Observable<T> {
    this.versionId.set(null);
    this.source.set('unavailable');
    this.tokens.canWrite.set(false);
    return of(value);
  }
}
