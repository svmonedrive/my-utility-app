import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { decodeBase64, GithubFile, githubHeaders, githubUrls } from './github-api';
import { GITHUB_DATA_CONFIG } from './github-data.config';
import { GithubTokenService } from './github-token.service';

/**
 * Reads JSON files from the app's folder in its GitHub repo. Files are named by their name inside
 * that folder, e.g. `'2026.json'`.
 *
 * - Without a token, anyone can read them (the repo is public).
 * - With the owner's token they are read through the GitHub API, which is always fresh and also tells
 *   us the file's version id, which a later save needs.
 * - If GitHub refuses the token, the file is read publicly instead (view only).
 * - If GitHub cannot be reached at all, `load` gives the value it was told to use and `source` says so.
 *
 * Which folder is set once, with `provideGithubData(...)`. Saving is `GithubCommitService`'s job.
 */
@Injectable({ providedIn: 'root' })
export class GithubReadService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(GithubTokenService);

  /** Which folder this service reads from. */
  readonly config = inject(GITHUB_DATA_CONFIG);

  /** Where the data on screen came from (set by the latest read of any file). */
  readonly source = signal<'github' | 'unavailable' | null>(null);

  /** The version id of each file as last read or written, by file name. Files read publicly have none. */
  private readonly versions = new Map<string, string>();

  /**
   * The version id of `file` as last read or written. GitHub only accepts a save that quotes the
   * current version, which is how it notices that the file was changed by someone else meanwhile.
   * Null when the file was read publicly (no way to save then).
   */
  version(file: string): string | null {
    return this.versions.get(file) ?? null;
  }

  /**
   * Reads `file`: with the token if there is one; if GitHub refuses that token, publicly instead.
   * If GitHub cannot be reached at all, the result is `unavailableValue` and `source` says
   * `unavailable`.
   */
  load<T>(file: string, unavailableValue: T): Observable<T> {
    const token = this.tokens.token();
    const withToken = (token: string) =>
      this.fetchWithToken<T>(file, token).pipe(
        tap(() => {
          this.source.set('github');
          this.tokens.rejected.set(false);
          this.tokens.canWrite.set(true);
        }),
        catchError((error: unknown) => {
          const status = error instanceof HttpErrorResponse ? error.status : -1;
          this.tokens.rejected.set(status === 401 || status === 403 || status === 404);
          return this.readPublic<T>(file);
        }),
      );
    const remote = token ? withToken(token) : this.readPublic<T>(file);
    return remote.pipe(catchError(() => this.unavailable(file, unavailableValue)));
  }

  /** Reads `file` through the API with a token, and remembers its version id. Changes nothing else. */
  fetchWithToken<T>(file: string, token: string): Observable<T> {
    // The time in the address stops the browser from showing a copy of the file that is a minute old.
    const params = { ref: this.config.branch, t: Date.now() };
    return this.http
      .get<GithubFile>(githubUrls(this.config, file).api, { headers: githubHeaders(token), params })
      .pipe(
        map((response) => {
          if (!response.content) {
            throw new Error('The file is too large to read through the API');
          }
          this.versions.set(file, response.sha);
          return JSON.parse(decodeBase64(response.content)) as T;
        }),
      );
  }

  /** Called after a save or create: `file` now has a new version id. */
  rememberVersion(file: string, versionId: string): void {
    this.versions.set(file, versionId);
  }

  /** Called when a working token was just added: GitHub is clearly reachable. */
  markReachable(): void {
    this.source.set('github');
  }

  private readPublic<T>(file: string): Observable<T> {
    return this.http.get<T>(githubUrls(this.config, file).public).pipe(
      tap(() => {
        this.versions.delete(file);
        this.source.set('github');
        this.tokens.canWrite.set(false);
      }),
    );
  }

  /** GitHub could not be reached: nothing to show, and nothing that could be saved. */
  private unavailable<T>(file: string, value: T): Observable<T> {
    this.versions.delete(file);
    this.source.set('unavailable');
    this.tokens.canWrite.set(false);
    return of(value);
  }
}
