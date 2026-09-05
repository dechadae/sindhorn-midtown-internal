/* Readability of the app's ink on the Betta as it is actually drawn. The
   atmosphere is sampled from a small second view of the live scene
   (betta-environment.js sampleBettaFrame), softened the way the glass
   softens it, and each sample is composited the way app-glass.css
   composites a card - the surface fill at its alpha over the sky - before
   the contrast is measured. Ink, muted and accent are the app's three text
   colors (app-tokens.css); muted is translucent and is flattened onto the
   same glass first. A period's reading is its lowest sample.

   The bar is WCAG's 4.5:1 for text - the app's body sizes - for every role.
   The seven period colors are listed for the eye; they are not what is
   measured, because a highlight hex is never what the glass shows. */
import {rgbToHex} from './betta-random.js';

const GLASS={rgb:[46/255,39/255,59/255],alpha:.30};
const INK={rgb:[250/255,247/255,245/255],alpha:1};
const MUTED={rgb:[250/255,247/255,245/255],alpha:.70};/* --app-muted; the alpha is the contract's ceiling, see app-tokens.css */
const ACCENT={rgb:[229/255,236/255,190/255],alpha:1};
export const READABILITY_ROLES=Object.freeze([
  {key:'ink',label:'Ink',color:INK},
  {key:'muted',label:'Muted',color:MUTED},
  {key:'accent',label:'Accent',color:ACCENT}
]);
export const READABILITY_MINIMUM=4.5;
/* The glass blur is 18px on a phone about 390px wide; a 64-sample-wide frame
   makes that a radius of about three samples. */
const SOFTEN_RADIUS=3;

const over=(top,alpha,under)=>under.map((v,i)=>top[i]*alpha+v*(1-alpha));
const channel=v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);
export const luminance=rgb=>.2126*channel(rgb[0])+.7152*channel(rgb[1])+.0722*channel(rgb[2]);
export function contrastRatio(a,b){const la=luminance(a),lb=luminance(b);return(Math.max(la,lb)+.05)/(Math.min(la,lb)+.05)}
export const glassOver=sky=>over(GLASS.rgb,GLASS.alpha,sky);

/* The seven colors a period paints: three sky stops and four fish colors. */
export function periodColors(style){
  const gradient=Array.isArray(style?.backgroundGradient)?style.backgroundGradient:[];
  const palette=Array.isArray(style?.palette)?style.palette:[];
  return[...gradient.map((hex,i)=>({key:`sky${i}`,label:`Sky ${i+1}`,hex})),...palette.map((hex,i)=>({key:`fish${i}`,label:`Fish ${i+1}`,hex}))];
}

/* Box-soften an RGBA frame; returns float RGB triples, one per sample. */
function soften(frame,radius=SOFTEN_RADIUS){
  const{width:w,height:h,data}=frame,out=new Float32Array(w*h*3),row=new Float32Array(w*h*3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let r=0,g=0,b=0,n=0;for(let k=-radius;k<=radius;k++){const xx=x+k;if(xx<0||xx>=w)continue;const i=(y*w+xx)*4;r+=data[i];g+=data[i+1];b+=data[i+2];n++}const o=(y*w+x)*3;row[o]=r/n;row[o+1]=g/n;row[o+2]=b/n}
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let r=0,g=0,b=0,n=0;for(let k=-radius;k<=radius;k++){const yy=y+k;if(yy<0||yy>=h)continue;const i=(yy*w+x)*3;r+=row[i];g+=row[i+1];b+=row[i+2];n++}const o=(y*w+x)*3;out[o]=r/n/255;out[o+1]=g/n/255;out[o+2]=b/n/255}
  return out;
}

/* One reading per role from a sampled frame: the lowest contrast on glass
   across the frame, with the sky color that produced it. */
export function measureFrame(frame){
  if(!frame||!frame.width||!frame.height||!frame.data)return null;
  const sky=soften(frame),count=frame.width*frame.height;
  const roles=READABILITY_ROLES.map(role=>{
    let worst=null;
    for(let i=0;i<count;i++){
      const glass=glassOver([sky[i*3],sky[i*3+1],sky[i*3+2]]);
      const ink=over(role.color.rgb,role.color.alpha,glass);
      const ratio=contrastRatio(ink,glass);
      if(!worst||ratio<worst.ratio)worst={ratio,hex:rgbToHex([sky[i*3],sky[i*3+1],sky[i*3+2]])};
    }
    return{key:role.key,label:role.label,ratio:worst.ratio,hex:worst.hex,pass:worst.ratio>=READABILITY_MINIMUM};
  });
  return{roles,pass:roles.every(role=>role.pass),lowest:roles.reduce((low,role)=>role.ratio<low.ratio?role:low,roles[0])};
}

/* The lower of two readings, role by role - how a watermark accumulates
   while the fish moves. */
export function lowerReading(a,b){
  if(!a)return b;if(!b)return a;
  const roles=a.roles.map((role,i)=>role.ratio<=b.roles[i].ratio?role:b.roles[i]);
  return{roles,pass:roles.every(role=>role.pass),lowest:roles.reduce((low,role)=>role.ratio<low.ratio?role:low,roles[0])};
}

export const ratioLabel=ratio=>`${(Math.round(ratio*10)/10).toFixed(1)}:1`;
