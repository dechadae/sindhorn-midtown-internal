export const CAMERA_REGISTRY=[
  {
    id:'bang-yi-khan-east-317138',
    name:'Bang Yi Khan · Krung Thon Bridge East',
    facing:'east',
    azimuthDeg:90,
    provider:'opencctv-public-source',
    sourcePage:'https://opencctv.org/cameras/thailand/bangkok/bang-yi-khan-subdistrict/bang-yi-khan-subdistrict-east-krung-thon-bridge-sang-hi-saphan-krung-thon-sang-hee-317138',
    feedType:'image',
    freshnessTargetSeconds:300,
    reliability:.86,
    rightsMode:'transient-analysis-only',
    automation:'public-image',
    enabled:true
  },
  {
    id:'bang-yi-khan-west-317474',
    name:'Bang Yi Khan · Krung Thon Bridge / Chao Phraya West',
    latitude:13.7813,
    longitude:100.5015,
    facing:'west',
    azimuthDeg:270,
    provider:'opencctv-public-source',
    sourcePage:'https://opencctv.org/cameras/thailand/bangkok/bang-yi-khan-subdistrict/bang-yi-khan-subdistrict-west-saphan-krung-thon-sang-hee-dbf-apartments-by-the-river-krung-thon-bridge-sang-hi-chao-phraya-317474',
    feedType:'image',
    freshnessTargetSeconds:300,
    reliability:.90,
    rightsMode:'transient-analysis-only',
    automation:'public-image',
    enabled:true
  },
  {
    id:'bang-phlat-east-318260',
    name:'Bang Phlat · Krung Thon Bridge East',
    facing:'east',
    azimuthDeg:90,
    provider:'opencctv-public-source',
    sourcePage:'https://opencctv.org/cameras/thailand/bangkok/bang-phlat-subdistrict/bang-phlat-subdistrict-east-saphan-krung-thon-sang-hee-krung-thon-bridge-sang-hi-318260',
    feedType:'image',
    freshnessTargetSeconds:300,
    reliability:.82,
    rightsMode:'transient-analysis-only',
    automation:'public-image',
    enabled:true
  },
  {
    id:'bang-phlat-west-318457',
    name:'Bang Phlat · Krung Thon Bridge West',
    facing:'west',
    azimuthDeg:270,
    provider:'opencctv-public-source',
    sourcePage:'https://opencctv.org/cameras/thailand/bangkok/bang-phlat-subdistrict/bang-phlat-subdistrict-west-krung-thon-bridge-sang-hi-saphan-krung-thon-sang-hee-318457',
    feedType:'image',
    freshnessTargetSeconds:300,
    reliability:.82,
    rightsMode:'transient-analysis-only',
    automation:'public-image',
    enabled:true
  },
  {
    id:'sathorn-silom-live-reference',
    name:'Sathorn / Silom central Bangkok livestream',
    facing:'central',
    provider:'youtube-live-reference',
    sourcePage:'https://www.youtube.com/watch?v=uDV_qKiXRVU',
    feedType:'video',
    freshnessTargetSeconds:120,
    reliability:.75,
    rightsMode:'manual-qa-until-provider-supported-frame-access',
    automation:'manual-reference',
    enabled:false
  },
  {
    id:'continent-bangkok-skyline-reference',
    name:'The Continent Hotel Bangkok skyline reference',
    facing:'central',
    provider:'skylinewebcams-reference',
    sourcePage:'https://www.skylinewebcams.com/en/webcam/thailand/central-thailand/bangkok/bangkok-crossroads.html',
    feedType:'video',
    freshnessTargetSeconds:300,
    reliability:.75,
    rightsMode:'manual-qa-until-automation-permitted',
    automation:'manual-reference',
    enabled:false
  }
];

export function automatedCameras(){return CAMERA_REGISTRY.filter(camera=>camera.enabled&&camera.automation==='public-image')}
export function publicCameraMetadata(){return CAMERA_REGISTRY.map(({sourcePage,...camera})=>({...camera,sourcePage:camera.automation==='manual-reference'?sourcePage:undefined}))}
