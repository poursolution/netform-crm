const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'../.work-netform-login-guidance'),p=path.join(base,'crm.html');
let s=fs.readFileSync(p,'utf8');
function replace(from,to){if(!s.includes(from))throw Error('Missing anchor: '+from.slice(0,100));s=s.replace(from,to)}
replace('<div class="mi clk" data-p="repmanage"','<div class="mi clk" data-p="control" onclick="nav(this)"><span class="ic">◎</span>컨트롤타워</div>\r\n      <div class="mi clk" data-p="repmanage"');
replace('<span class="ic">👥</span>담당자 실적','<span class="ic">👥</span>성과 분석');
replace('<div class="apage" id="pg-dash">','<div class="apage" id="pg-control"><div id="si-control"></div></div>\r\n    <div class="apage" id="pg-dash"><div id="si-dash"></div>');
replace('<div class="apage" id="pg-perf">','<div class="apage" id="pg-perf"><div id="si-perf"></div>');
replace("dash:['영업 대시보드','전 브랜드 통합 현황 · Supabase 실데이터'],","dash:['영업 대시보드','전체 영업 흐름과 현재 관리가 필요한 지점을 확인합니다.'],\r\n control:['컨트롤타워','확인이 필요한 영업 건을 찾아 바로 조치합니다.'],");
replace("perf:['담당자 실적','실적 / 미래 가능성 / 관리 리스크']","perf:['성과 분석','실적·진행상태·관리 이슈를 같은 기준으로 확인합니다.']");
replace("if(G.page==='pipe'||G.page==='work'||G.page==='perf'||G.page==='report')return deal;","if(G.page==='perf'||G.page==='control')return deal||inquiry;\r\n  if(G.page==='pipe'||G.page==='work'||G.page==='report')return deal;");
replace("p==='today'||p==='dash'||p==='inq'","p==='today'||p==='dash'||p==='control'||p==='perf'||p==='inq'");
replace('function clearTransientUI(){','function clearTransientUI(){\r\n if(window.SalesInsights)SalesInsights.close(false);');
replace("pipelinePage=G.page==='pipe',periodEl=","pipelinePage=G.page==='pipe',insightsPage=['dash','control','perf'].includes(G.page)&&!!window.SalesInsights,periodEl=");
replace('var hidePeriod=customerMaster','var hidePeriod=insightsPage||customerMaster');
replace('hideRep=customerMaster','hideRep=insightsPage||customerMaster');
replace("if(!hidePeriod)paintPeriod();if(!hideRep)paintRepTabs();","if(!hidePeriod)paintPeriod();if(!hideRep)paintRepTabs();\r\n var searchEl=$('#q');if(searchEl)searchEl.style.display=insightsPage?'none':'';\r\n if(insightsPage){SalesInsights.render();return;}");
replace('<script src="./today-work-queue.js?v=20260920-independent-1"></script>','<script src="./today-work-queue.js?v=20260920-independent-1"></script><link rel="stylesheet" href="./sales-insights.css?v=20260920-1"><script src="./sales-insights-model.js?v=20260920-1"></script><script src="./sales-insights.js?v=20260920-1"></script>');
fs.writeFileSync(p,s);
