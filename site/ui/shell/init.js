import {initPullToReload} from './pull-to-reload.js';

function start(){initPullToReload()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
