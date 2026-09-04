/* Builds site/betta-runtime-full.js, the one Betta payload the shell loads.

   The bundle is committed, so the sources it was built from must stay in the
   repository and the build must be reproducible: `--check` rebuilds to a
   temporary file and fails when the committed bundle differs from its
   sources. deploy.yml runs that before every release. Without `--check` the
   bundle is rewritten in place - run it after editing any Betta source:

     node scripts/build-betta-runtime.mjs          # rebuild
     node scripts/build-betta-runtime.mjs --check  # verify (CI)

   The recipe is the one the retired betta-runtime-build workflow used; the
   esbuild version is pinned because a different minifier emits a different
   file. */
import {execFileSync} from 'node:child_process';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const ESBUILD='esbuild@0.25.9';
const ENTRY='site/betta-environment.js';
const OUT='site/betta-runtime-full.js';
const check=process.argv.includes('--check');

const dir=mkdtempSync(join(tmpdir(),'betta-build-'));
const target=check?join(dir,'betta-runtime-full.js'):OUT;
try{
  execFileSync('npx',['--yes',ESBUILD,ENTRY,'--bundle','--format=esm','--platform=browser','--target=es2022','--tree-shaking=true','--minify','--legal-comments=none',`--outfile=${target}`],{stdio:['ignore','ignore','inherit']});
  const built=readFileSync(target);
  if(check){
    const committed=readFileSync(OUT);
    if(!built.equals(committed)){
      console.error(`${OUT} (${committed.length} bytes) does not match a fresh build of ${ENTRY} (${built.length} bytes). Run node scripts/build-betta-runtime.mjs and commit the result.`);
      process.exit(1);
    }
  }
  console.log(JSON.stringify({ok:true,mode:check?'check':'build',bytes:built.length,entry:ENTRY,out:OUT}));
}finally{rmSync(dir,{recursive:true,force:true})}
