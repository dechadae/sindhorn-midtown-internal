import {readFile,writeFile} from 'node:fs/promises';

const path='site/share/fnb-share.css';
const css=await readFile(path,'utf8');
const normalized=css.replaceAll('font-family:Georgia,serif','font-family:var(--font-ui)');
if(normalized===css)throw new Error('Expected generated public masthead font token was not found');
await writeFile(path,normalized);
console.log('Public F&B share font normalized to LINE Seed authority');
