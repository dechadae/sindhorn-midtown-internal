import fs from 'node:fs';

const files=[
  'site/fnb.css','site/settings.css','site/business-dashboard.css','site/brand.css',
  'site/hotel-factsheet.css','site/ihg-history.css','site/ci.css'
];

let repaired=0;
for(const path of files){
  const before=fs.readFileSync(path,'utf8');
  const after=before.replace(/([^;{}\s])backdrop-filter:/g,'$1;backdrop-filter:');
  if(after!==before){fs.writeFileSync(path,after);repaired++;console.log(`repaired ${path}`)}
  const verify=fs.readFileSync(path,'utf8');
  if(/[^;{}\s]backdrop-filter:/.test(verify))throw new Error(`${path}: malformed backdrop-filter boundary remains`);
}
if(!repaired)throw new Error('No malformed migrated declarations were found to repair');
console.log(`Repaired ${repaired} migrated stylesheet(s).`);
