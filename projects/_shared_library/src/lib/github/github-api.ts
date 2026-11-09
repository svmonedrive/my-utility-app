import { HttpHeaders } from '@angular/common/http';
import { GithubDataConfig } from './github-data.config';

// The plain building blocks for talking to GitHub: addresses, headers, and the text format GitHub
// uses for file contents. No state in here; the read and commit services use them.

/** The shape of GitHub's answer when asked for a file through the contents API. */
export interface GithubFile {
  /** The file's text, base64 encoded. Empty for files too large for this API. */
  content: string;
  /** The file's version id. A save must quote it. */
  sha: string;
}

/** The addresses an app needs for its one data file. */
export interface GithubUrls {
  /** The contents API address of the file: read with a token, and save. */
  api: string;
  /** Used only to test that a token can write. */
  blobs: string;
  /** Public address of the file: what visitors read, no token needed (GitHub caches it for a few minutes). */
  public: string;
}

export function githubUrls(config: GithubDataConfig): GithubUrls {
  const repo = `${config.owner}/${config.repo}`;
  return {
    api: `https://api.github.com/repos/${repo}/contents/${config.path}`,
    blobs: `https://api.github.com/repos/${repo}/git/blobs`,
    public: `https://raw.githubusercontent.com/${repo}/${config.branch}/${config.path}`,
  };
}

export function githubHeaders(token: string): HttpHeaders {
  return new HttpHeaders({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  });
}

export function encodeBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function decodeBase64(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
