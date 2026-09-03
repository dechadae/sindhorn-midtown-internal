export const APPROVED_CI_BRANCH='preview-ci-glass';
export const APPROVED_CI_SHA='4ab3639f0dc18c87573578b95cd7c8f5c3d4122c';
export const APPROVED_CI_URL='https://preview-ci-glass.sindhorn-midtown-internal.pages.dev/?review=ci-central-glass';

export const APPROVED_CI_CONTRACT=Object.freeze({
  font:'LINE Seed Sans TH',
  weights:Object.freeze([100,400,700]),
  tracking:0,
  colors:Object.freeze({vignette:'#2E273B',white:'#FAF7F5',sorbet:'#E5ECBE'}),
  glass:Object.freeze({fill:'rgba(46,39,59,.30)',border:'rgba(250,247,245,.14)',filter:'blur(18px) saturate(1.18)'}),
  hero:Object.freeze({paddingTop:22,paddingBottom:20,eyebrow:9,title:'clamp(30px,8.5vw,44px)',copy:13}),
  controls:Object.freeze({backSize:36,backRadius:12,utilityHeight:36,utilityFont:12}),
  shapes:Object.freeze({indicator:2,badge:5,icon:8,chip:9,control:12,footerItem:13,card:14}),
  motion:Object.freeze({fast:160,base:260,disclosure:420,route:280})
});
