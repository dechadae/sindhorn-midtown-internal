import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';

const ROOT=resolve('site');
const INPUT=join(ROOT,'assets/brand/sindhorn-midtown-vignette-white.png');
const OUT=join(ROOT,'icons');
const BG={r:46,g:39,b:59,alpha:1};
await mkdir(OUT,{recursive:true});

async function trimmedLogo(){
  const image=sharp(INPUT).trim({background:{r:0,g:0,b:0,alpha:0},threshold:4});
  const {data,info}=await image.png().toBuffer({resolveWithObject:true});
  return {data,width:info.width,height:info.height}
}
const logo=await trimmedLogo();
async function render(name,size,widthRatio){
  const targetW=Math.round(size*widthRatio),targetH=Math.round(size*.66);
  const resized=await sharp(logo.data).resize({width:targetW,height:targetH,fit:'inside',withoutEnlargement:false}).png().toBuffer();
  const meta=await sharp(resized).metadata();
  const left=Math.round((size-meta.width)/2),top=Math.round((size-meta.height)/2);
  await sharp({create:{width:size,height:size,channels:4,background:BG}}).composite([{input:resized,left,top}]).png({compressionLevel:9}).toFile(join(OUT,name));
  return {name,size,logoWidth:meta.width,logoHeight:meta.height,widthRatio:Number((meta.width/size).toFixed(3)),heightRatio:Number((meta.height/size).toFixed(3))}
}
const report=[];
report.push(await render('app-192.png',192,.80));
report.push(await render('app-512.png',512,.80));
report.push(await render('maskable-512.png',512,.70));
report.push(await render('apple-touch-icon.png',180,.78));
console.log(JSON.stringify({source:{width:logo.width,height:logo.height},icons:report},null,2));
