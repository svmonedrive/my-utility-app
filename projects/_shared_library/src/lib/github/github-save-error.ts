import { HttpErrorResponse } from '@angular/common/http';

/** What a failed save to GitHub means, in words the owner can act on. `repo` is the data repo's name. */
export function describeGithubSaveError(error: unknown, repo: string): string {
  const status = error instanceof HttpErrorResponse ? error.status : -1;
  if (status === 409 || status === 422) {
    return 'The data on GitHub changed since you opened this page. Reload the page, then make your change again.';
  }
  if (status === 403) {
    return `GitHub refused the save: the token can read but not write. In the token settings, choose "Only select repositories" with ${repo}, and set Contents to "Read and write". Then remove and add the token again.`;
  }
  if (status === 401 || status === 404) {
    return 'GitHub did not accept the token. It may have expired, or been deleted. Add a new token with the key button.';
  }
  if (status === 0) {
    return 'Could not reach GitHub. Check your connection and try again.';
  }
  return 'Saving failed. Try again.';
}
