const finiteNumber=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

/**
 * Resolve current precipitation from a fresh TMD AWS observation.
 *
 * TMD weatherType is the current-condition observation. The 15-minute gauge is
 * a trailing accumulation and therefore must not veto a fresh rain condition,
 * nor may lingering accumulation keep rain active after TMD reports a dry
 * current condition.
 */
export function resolveTmdCurrentRain({fresh=false,weatherCode=null,weatherTypeRainHint=false,precip15MinsMm=0}={}){
  const code=finiteNumber(weatherCode);
  const codeKnown=code!==null&&code>=0;
  const accumulation=Math.max(0,finiteNumber(precip15MinsMm)??0);
  const currentConditionAvailable=Boolean(fresh&&codeKnown);
  const observedWet=Boolean(currentConditionAvailable&&weatherTypeRainHint);
  const observedDry=Boolean(currentConditionAvailable&&!weatherTypeRainHint);
  return{
    currentConditionAvailable,
    observedWet,
    observedDry,
    recentAccumulationMm:accumulation,
    evidence:observedWet?'current-condition-wet':observedDry?'current-condition-dry':'ambiguous'
  };
}
