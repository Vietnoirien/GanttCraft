import { readFileSync } from 'node:fs';

const { name, version, repository } = JSON.parse(
  readFileSync(new URL('../packages/ganttcraft/package.json', import.meta.url), 'utf8')
);
const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME;

if (name !== 'ganttcraft' || !version || tag !== `v${version}`) {
  throw new Error(`Release tag ${tag ?? '(missing)'} must match ganttcraft package version v${version}.`);
}
if (repository?.url !== 'https://github.com/Vietnoirien/GanttCraft') {
  throw new Error('Package repository.url must match the GitHub repository for npm trusted publishing.');
}

console.log(`Publishing ${name}@${version} from ${tag}.`);
