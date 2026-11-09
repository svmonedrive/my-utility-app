import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, tap, throwError } from 'rxjs';
import { encodeBase64, githubHeaders, githubUrls } from './github-api';
import { GITHUB_DATA_CONFIG } from './github-data.config';
import { GithubReadService } from './github-read.service';
import { GithubTokenService } from './github-token.service';

/**
 * Writes the app's JSON file back to its GitHub repo, as a commit. Needs the owner's token. Reading
 * is `GithubReadService`'s job; this one builds on it, because a save has to quote the file's
 * current version id, which the read service remembers.
 */
@Injectable({ providedIn: 'root' })
export class GithubCommitService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(GithubTokenService);
  private readonly reader = inject(GithubReadService);
  private readonly config = inject(GITHUB_DATA_CONFIG);
  private readonly urls = githubUrls(this.config);

  /** Commits the data to the repo. Fails with HTTP 409/422 if the file changed on GitHub meanwhile. */
  save(data: unknown): Observable<void> {
    const token = this.tokens.token();
    const version = this.reader.version();
    if (!token || !version) {
      return throwError(() => new Error('Not connected to GitHub'));
    }
    const body = {
      message: this.config.commitMessage ?? 'Update data from my-utility-app',
      content: encodeBase64(JSON.stringify(data, null, 2) + '\n'),
      sha: version,
      branch: this.config.branch,
    };
    return this.http
      .put<{ content: { sha: string } }>(this.urls.api, body, { headers: githubHeaders(token) })
      .pipe(
        tap((response) => this.reader.rememberVersion(response.content.sha)),
        map(() => undefined),
      );
  }

  /**
   * Checks a token and keeps it only if it works. Reading proves nothing on a public repo (any token
   * can read), so it also checks that the token can WRITE: it asks GitHub to store a tiny empty
   * object, which makes no commit and changes nothing visible. A read-only token fails with HTTP 403.
   * Resolves with the data that was read, so the caller can show it.
   */
  connect(token: string): Observable<unknown> {
    return this.reader.fetchWithToken<unknown>(token).pipe(
      switchMap((data) =>
        this.http
          .post(
            this.urls.blobs,
            { content: 'write access check', encoding: 'utf-8' },
            { headers: githubHeaders(token) },
          )
          .pipe(map(() => data)),
      ),
      tap(() => {
        this.tokens.accept(token);
        this.reader.markReachable();
      }),
    );
  }
}
