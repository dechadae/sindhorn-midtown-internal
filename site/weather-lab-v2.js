import {mountWeatherLabRoute as mountBaseWeatherLab} from './weather-lab.js?v=1';
import {mountCameraWeatherLab} from './weather-camera-lab.js?v=1';

export async function mountWeatherLabRoute(root,context={}){
  const baseCleanup=await mountBaseWeatherLab(root,context);
  const cameraCleanup=await mountCameraWeatherLab(root,context);
  return async()=>{
    try{if(typeof cameraCleanup==='function')await cameraCleanup()}catch(_){ }
    try{if(typeof baseCleanup==='function')await baseCleanup()}catch(_){ }
  };
}
