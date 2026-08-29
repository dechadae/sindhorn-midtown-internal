import {readFile,writeFile} from 'node:fs/promises';

const path='site/share/fnb-share.css';
const css=await readFile(path,'utf8');
const normalized=css.replaceAll('font-family:Georgia,serif','font-family:var(--font-ui)');
if(normalized!==css)await writeFile(path,normalized);
if(!normalized.includes('font-family:var(--font-ui)'))throw new Error('Public F&B share CSS is missing the LINE Seed font authority');
console.log('Public F&B share font normalized to LINE Seed authority');
