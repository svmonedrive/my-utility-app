import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, tap, throwError } from 'rxjs';
import { encodeBase64, githubHeaders, githubUrls } from './github-api';
import { GITHUB_DATA_CONFIG } from './github-data.config';
import { GithubReadService } from './github-read.service';
import { GithubTokenService } from './github-token.service';

/**
 * Writes JSON files in the app's folder back to its GitHub repo, as commits. Needs the owner's token.
 * Reading is `GithubReadService`'s job; this one builds on it, because a save has to quote the file's
 * current version id, which the read service remembers.
 */
@Injectable({ providedIn: 'root' })
export class GithubCommitService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(GithubTokenService);
  private readonly reader = inject(GithubReadService);
  private readonly config = inject(GITHUB_DATA_CONFIG);

  /**
   * Commits `data` as the new content of `file`, which must have been read with the token first.
   * Fails with HTTP 409/422 if the file changed on GitHub meanwhile.
   */
  save(file: string, data: unknown): Observable<void> {
    const token = this.tokens.token();
    const version = this.reader.version(file);
    if (!token || !version) {
      return throwError(() => new Error('Not connected to GitHub'));
    }
    return this.write(file, data, token, version);
  }

  /** Creates `file` with `data` as a new commit. Fails with HTTP 422 if the file already exists. */
  create(file: string, data: unknown): Observable<void> {
    const token = this.tokens.token();
    if (!token) {
      return throwError(() => new Error('Not connected to GitHub'));
    }
    return this.write(file, data, token, null);
  }

  /**
   * Checks a token and keeps it only if it works. Reading proves nothing on a public repo (any token
   * can read), so it also checks that the token can WRITE: it asks GitHub to store a tiny empty
   * object, which makes no commit and changes nothing visible. A read-only token fails with HTTP 403,
   * a wrong or expired one with 401.
   */
  connect(token: string): Observable<void> {
    const urls = githubUrls(this.config, '');
    return this.http.get(urls.repo, { headers: githubHeaders(token) }).pipe(
      switchMap(() =>
        this.http.post(
          urls.blobs,
          { content: 'write access check', encoding: 'utf-8' },
          { headers: githubHeaders(token) },
        ),
      ),
      tap(() => {
        this.tokens.accept(token);
        this.reader.markReachable();
      }),
      map(() => undefined),
    );
  }

  /** One commit of `file`. With a version id it updates the file; without one it creates it. */
  private write(
    file: string,
    data: unknown,
    token: string,
    version: string | null,
  ): Observable<void> {
    const body = {
      message: `${this.config.commitMessage ?? 'Update data from my-utility-app'} (${file})`,
      content: encodeBase64(JSON.stringify(data, null, 2) + '\n'),
      branch: this.config.branch,
      ...(version ? { sha: version } : {}),
    };
    return this.http
      .put<{ content: { sha: string } }>(githubUrls(this.config, file).api, body, {
        headers: githubHeaders(token),
      })
      .pipe(
        tap((response) => this.reader.rememberVersion(file, response.content.sha)),
        map(() => undefined),
      );
  }
}
