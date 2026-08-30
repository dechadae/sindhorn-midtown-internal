// Minimal local QR encoder for short Sindhorn invitation URLs.
// Fixed QR Version 6, error correction M, byte mode. No network dependency.
const VERSION=6,SIZE=41,DATA_CODEWORDS=108,BLOCKS=4,DATA_PER_BLOCK=27,EC_PER_BLOCK=16;

const gfExp=new Uint8Array(512),gfLog=new Uint8Array(256);
{
  let x=1;
  for(let i=0;i<255;i++){
    gfExp[i]=x;gfLog[x]=i;
    x<<=1;if(x&0x100)x^=0x11d;
  }
  for(let i=255;i<512;i++)gfExp[i]=gfExp[i-255];
}
const gfMul=(a,b)=>a&&b?gfExp[gfLog[a]+gfLog[b]]:0;

function rsGenerator(degree){
  let poly=[1];
  for(let i=0;i<degree;i++){
    const next=new Array(poly.length+1).fill(0),root=gfExp[i];
    for(let j=0;j<poly.length;j++){
      next[j]^=poly[j];
      next[j+1]^=gfMul(poly[j],root);
    }
    poly=next;
  }
  return poly;
}
const RS_GEN=rsGenerator(EC_PER_BLOCK);
function rsRemainder(data){
  const out=new Uint8Array(EC_PER_BLOCK);
  for(const value of data){
    const factor=value^out[0];
    out.copyWithin(0,1);out[EC_PER_BLOCK-1]=0;
    for(let i=0;i<EC_PER_BLOCK;i++)out[i]^=gfMul(RS_GEN[i+1],factor);
  }
  return out;
}

function appendBits(target,value,length){for(let i=length-1;i>=0;i--)target.push((value>>>i)&1)}
function buildCodewords(text){
  const bytes=[...new TextEncoder().encode(String(text))];
  if(bytes.length>106)throw new Error('Invitation URL is too long for local QR encoder.');
  const bits=[];
  appendBits(bits,0b0100,4);appendBits(bits,bytes.length,8);
  bytes.forEach(byte=>appendBits(bits,byte,8));
  const capacity=DATA_CODEWORDS*8;
  for(let i=0;i<Math.min(4,capacity-bits.length);i++)bits.push(0);
  while(bits.length%8)bits.push(0);
  const data=[];
  for(let i=0;i<bits.length;i+=8){let value=0;for(let j=0;j<8;j++)value=(value<<1)|bits[i+j];data.push(value)}
  for(let pad=0;data.length<DATA_CODEWORDS;pad++)data.push(pad%2?0x11:0xec);

  const blocks=[],ecc=[];
  for(let b=0;b<BLOCKS;b++){
    const block=Uint8Array.from(data.slice(b*DATA_PER_BLOCK,(b+1)*DATA_PER_BLOCK));
    blocks.push(block);ecc.push(rsRemainder(block));
  }
  const out=[];
  for(let i=0;i<DATA_PER_BLOCK;i++)for(let b=0;b<BLOCKS;b++)out.push(blocks[b][i]);
  for(let i=0;i<EC_PER_BLOCK;i++)for(let b=0;b<BLOCKS;b++)out.push(ecc[b][i]);
  return out;
}

const cloneMatrix=matrix=>matrix.map(row=>row.slice());
function emptyMatrix(){return Array.from({length:SIZE},()=>Array(SIZE).fill(false))}
function emptyFlags(){return Array.from({length:SIZE},()=>Array(SIZE).fill(false))}
function inBounds(x,y){return x>=0&&y>=0&&x<SIZE&&y<SIZE}
function setFunction(matrix,flags,x,y,dark){if(!inBounds(x,y))return;matrix[y][x]=Boolean(dark);flags[y][x]=true}

function drawFinder(matrix,flags,cx,cy){
  for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    const x=cx+dx,y=cy+dy;if(!inBounds(x,y))continue;
    const dist=Math.max(Math.abs(dx),Math.abs(dy));
    setFunction(matrix,flags,x,y,dist!==2&&dist!==4);
  }
}
function drawAlignment(matrix,flags,cx,cy){
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)setFunction(matrix,flags,cx+dx,cy+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
}
function formatBits(mask){
  const data=mask; // Error correction level M has format bits 00.
  let rem=data;
  for(let i=0;i<10;i++)rem=(rem<<1)^(((rem>>>9)&1)*0x537);
  return ((data<<10)|rem)^0x5412;
}
function drawFormat(matrix,flags,mask){
  const bits=formatBits(mask),bit=i=>((bits>>>i)&1)!==0;
  for(let i=0;i<=5;i++)setFunction(matrix,flags,8,i,bit(i));
  setFunction(matrix,flags,8,7,bit(6));setFunction(matrix,flags,8,8,bit(7));setFunction(matrix,flags,7,8,bit(8));
  for(let i=9;i<15;i++)setFunction(matrix,flags,14-i,8,bit(i));
  for(let i=0;i<8;i++)setFunction(matrix,flags,SIZE-1-i,8,bit(i));
  for(let i=8;i<15;i++)setFunction(matrix,flags,8,SIZE-15+i,bit(i));
  setFunction(matrix,flags,8,SIZE-8,true);
}
function buildBase(codewords){
  const matrix=emptyMatrix(),flags=emptyFlags();
  drawFinder(matrix,flags,3,3);drawFinder(matrix,flags,SIZE-4,3);drawFinder(matrix,flags,3,SIZE-4);
  for(let i=8;i<SIZE-8;i++){
    if(!flags[6][i])setFunction(matrix,flags,i,6,i%2===0);
    if(!flags[i][6])setFunction(matrix,flags,6,i,i%2===0);
  }
  drawAlignment(matrix,flags,34,34);
  drawFormat(matrix,flags,0);

  const bits=[];codewords.forEach(byte=>appendBits(bits,byte,8));
  let bitIndex=0;
  for(let right=SIZE-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<SIZE;vert++){
      const upward=((right+1)&2)===0,y=upward?SIZE-1-vert:vert;
      for(let j=0;j<2;j++){
        const x=right-j;if(flags[y][x])continue;
        matrix[y][x]=bitIndex<bits.length?Boolean(bits[bitIndex]):false;bitIndex++;
      }
    }
  }
  return{matrix,flags};
}
const maskFn=(mask,x,y)=>{
  const p=x*y;
  switch(mask){
    case 0:return (x+y)%2===0;
    case 1:return y%2===0;
    case 2:return x%3===0;
    case 3:return (x+y)%3===0;
    case 4:return (Math.floor(y/2)+Math.floor(x/3))%2===0;
    case 5:return (p%2)+(p%3)===0;
    case 6:return ((p%2)+(p%3))%2===0;
    default:return (((x+y)%2)+(p%3))%2===0;
  }
};
function applyMask(base,flags,mask){
  const matrix=cloneMatrix(base);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(!flags[y][x]&&maskFn(mask,x,y))matrix[y][x]=!matrix[y][x];
  drawFormat(matrix,flags,mask);return matrix;
}
function penalty(matrix){
  let score=0;
  const runPenalty=line=>{
    let s=0,last=line[0],run=1;
    for(let i=1;i<line.length;i++){
      if(line[i]===last)run++;
      else{if(run>=5)s+=3+(run-5);last=line[i];run=1}
    }
    if(run>=5)s+=3+(run-5);return s;
  };
  for(let y=0;y<SIZE;y++)score+=runPenalty(matrix[y]);
  for(let x=0;x<SIZE;x++)score+=runPenalty(Array.from({length:SIZE},(_,y)=>matrix[y][x]));
  for(let y=0;y<SIZE-1;y++)for(let x=0;x<SIZE-1;x++){
    const v=matrix[y][x];if(matrix[y][x+1]===v&&matrix[y+1][x]===v&&matrix[y+1][x+1]===v)score+=3;
  }
  const a='00001011101',b='10111010000';
  const scan=line=>{const s=line.map(v=>v?'1':'0').join('');let p=0;for(let i=0;i<=s.length-11;i++){const sub=s.slice(i,i+11);if(sub===a||sub===b)p+=40}return p};
  for(let y=0;y<SIZE;y++)score+=scan(matrix[y]);
  for(let x=0;x<SIZE;x++)score+=scan(Array.from({length:SIZE},(_,y)=>matrix[y][x]));
  let dark=0;for(const row of matrix)for(const value of row)if(value)dark++;
  score+=Math.floor(Math.abs(dark*20-SIZE*SIZE*10)/(SIZE*SIZE))*10;
  return score;
}

export function qrMatrix(text){
  const {matrix:base,flags}=buildBase(buildCodewords(text));
  let best=null,bestScore=Infinity;
  for(let mask=0;mask<8;mask++){
    const candidate=applyMask(base,flags,mask),score=penalty(candidate);
    if(score<bestScore){bestScore=score;best=candidate}
  }
  return best;
}

export function qrSvg(text,{foreground='#2E273B',background='#FAF7F5',quiet=4}={}){
  const matrix=qrMatrix(text),size=SIZE+quiet*2;
  let path='';
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(matrix[y][x])path+=`M${x+quiet} ${y+quiet}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="One-time sign-in QR code" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${background}"/><path d="${path}" fill="${foreground}"/></svg>`;
}

// Flipgazine-style presentation renderer. It deliberately reuses the exact
// Version-6/M matrix above so existing QR capacity, masking and scan behavior
// stay unchanged; only the SVG presentation changes.
export function qrStyledSvg(text,{foreground='#0D1110',background='#F4F1EB',quiet=3,dotRadius=.46,finderRadius=2.1,cornerRatio=.06}={}){
  const matrix=qrMatrix(text),size=SIZE+quiet*2,cornerRadius=size*cornerRatio;
  const isFinder=(x,y)=>(x<7&&y<7)||(x>=SIZE-7&&y<7)||(x<7&&y>=SIZE-7);
  const finder=(x,y)=>`<rect x="${x}" y="${y}" width="7" height="7" rx="${finderRadius}" fill="none" stroke="${foreground}" stroke-width="1"/><rect x="${x+2}" y="${y+2}" width="3" height="3" rx="1" fill="${foreground}"/>`;
  let dots='';
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(!matrix[y][x]||isFinder(x,y))continue;
    dots+=`<circle cx="${x+quiet+.5}" cy="${y+quiet+.5}" r="${dotRadius}"/>`;
  }
  return `<svg class="fg-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="QR code" shape-rendering="geometricPrecision"><rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${background}"/><g fill="${foreground}">${dots}</g>${finder(quiet,quiet)}${finder(quiet+SIZE-7,quiet)}${finder(quiet,quiet+SIZE-7)}</svg>`;
}
