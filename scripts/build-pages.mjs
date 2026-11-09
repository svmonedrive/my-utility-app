// Builds every app and assembles one static site for GitHub Pages:
//   dist/site/            -> home
//   dist/site/<app>/      -> each utility app
import { execSync } from 'node:child_process';
import { cpSync, copyFileSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';

const REPO = 'my-utility-app';
const HOME = 'home';
// Every application in angular.json except the home shell. Libraries (like `_shared_library`) are not sites: the
// apps compile them from source, so they need no build of their own here.
const projects = JSON.parse(readFileSync('angular.json', 'utf8')).projects;
const APPS = Object.keys(projects).filter(
  (name) => name !== HOME && projects[name].projectType === 'application',
);
const SITE = 'dist/site';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

rmSync('dist', { recursive: true, force: true });
mkdirSync(SITE, { recursive: true });

run(`npx ng build ${HOME} --base-href /${REPO}/`);
cpSync(`dist/${HOME}/browser`, SITE, { recursive: true });
copyFileSync(`${SITE}/index.html`, `${SITE}/404.html`);

for (const app of APPS) {
  run(`npx ng build ${app} --base-href /${REPO}/${app}/`);
  cpSync(`dist/${app}/browser`, `${SITE}/${app}`, { recursive: true });
  copyFileSync(`${SITE}/${app}/index.html`, `${SITE}/${app}/404.html`);
}

writeFileSync(`${SITE}/.nojekyll`, '');
console.log(`\nSite ready in ${SITE}`);
