/* 내 현장 필터의 값 검증만 담당한다. 자료 조회·저장·권한 변경은 하지 않는다. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.MobileMineFilterModel=api;
})(typeof window!=='undefined'?window:typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const allBrand=v=>v==null||v==='전체'?'':v;
 function draft(value={}){return {brand:typeof allBrand(value.brand)==='string'?allBrand(value.brand):'',stage:typeof value.stage==='string'?value.stage:'',openOnly:value.openOnly===true};}
 function options(rows,stages,brandOf=d=>d&&d.brand){
  const brands=[...new Set((Array.isArray(rows)?rows:[]).map(brandOf).filter(v=>typeof v==='string'&&v.trim()&&v!=='전체'))];
  const seen=new Set(['']),allowedStages=[{key:'',label:'전체'}];
  for(const s of Array.isArray(stages)?stages:[])if(s&&typeof s.key==='string'&&s.key!=='expansion'&&!seen.has(s.key)&&typeof s.label==='string'){
   seen.add(s.key);allowedStages.push({key:s.key,label:s.label});
  }
  return {brands,stages:allowedStages};
 }
 function validate(value,allowed={}){
  if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,error:'필터 조건을 다시 선택해 주세요.'};
  const brand=allBrand(value.brand),stage=value.stage,openOnly=value.openOnly;
  if(typeof brand!=='string'||brand&&!Array.isArray(allowed.brands)||brand&&!(allowed.brands||[]).includes(brand))return {ok:false,error:'현재 내 현장에 있는 브랜드를 선택해 주세요.'};
  if(typeof stage!=='string'||stage&&!(Array.isArray(allowed.stages)&&allowed.stages.some(s=>s&&s.key===stage)))return {ok:false,error:'현재 사용할 수 있는 단계를 선택해 주세요.'};
  if(typeof openOnly!=='boolean')return {ok:false,error:'진행 중만 보기 조건을 다시 선택해 주세요.'};
  return {ok:true,value:{brand,stage,openOnly}};
 }
 function count(value){const v=draft(value);return Number(!!v.brand)+Number(!!v.stage)+Number(v.openOnly);}
 function matches(value,record={}){const v=draft(value);return (!v.brand||record.brand===v.brand)&&(!v.stage||record.stage===v.stage)&&(!v.openOnly||record.open===true);}
 return Object.freeze({draft,options,validate,count,matches});
});
