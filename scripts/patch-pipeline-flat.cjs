const fs=require('fs');const path='.work-netform-login-guidance/pipeline-workspace.js';let s=fs.readFileSync(path,'utf8');
function replace(a,b){if(!s.includes(a))throw Error('Missing: '+a);s=s.replace(a,b)}
replace("if(!def){body=", "if(!def&&f.view!=='list'){body=");
replace("const extra={relationship:['마지막 접촉','관계상태'],competition:['구분','결정 예정일','경쟁사'],construction:['계약상태','계약금액','착공일'],won:['확정 수주금액','수주일','준공일'],lost:['실주사유','경쟁사','실주일','실주금액'],expansion:['기존 공사','기존 계약금액','추가 공사 후보','마지막 접촉']}[key]||['예상금액',key==='sent'?'자료 발송일':'견적 예정일','마지막 접촉']", "const extra={all:['현재 단계','예상금액'],relationship:['관계상태','마지막 접촉','경과'],competition:['구분','결정 예정일','경쟁사','준비 현황'],construction:['계약상태','계약일','계약금액','실적 귀속','착공일'],won:['계약금액','계약일','실적 귀속','현재 진행'],lost:['실주일','실주금액','실주사유','경쟁사'],expansion:['기존 공사','기존 계약금액','추가 공사 후보','마지막 접촉'],sent:['자료 발송일','발송 자료','고객 반응','후속 확인일']}[key]||['공종','예상금액','견적 예정일','마지막 접촉']");
replace("body=metrics(list,key)+'<div", "body='<div");
replace("+'</small></td><td>'+button('처리','record',r.key)+'</td></tr>'", "+'</small></td><td>'+management(r)+'</td></tr>'");
replace("+'건</b></header><div class=\"ps-filters\">'", "+'건</b></header>'+metrics(list,key)+(!def?'<nav class=\"ps-view\" aria-label=\"파이프라인 보기\">'+button('보드','view','board',f.view!=='list'?'selected':'')+button('목록','view','list',f.view==='list'?'selected':'')+'</nav>':'')+'<div class=\"ps-filters\">'");
replace("if(a==='stage')open(v);", "if(a==='stage')open(v);if(a==='view'){state().view=v;state().page=1;root.paint();}");
replace("if(a==='record'){", "if(a==='record'||a==='process'){");
replace("root.drwDeal(JSON.stringify(r.item));}}", "root.drwDeal(JSON.stringify(r.item));if(a==='process')root.DetailActions?.open(r.flags.includes('missing')?'next':'activity');}}");
replace("if(key){root.closeDetail();open(key);}","if(key){const wasOpen=document.getElementById('detailView')?.classList.contains('on');open(key);if(wasOpen){root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}}" );
replace("key==='won'?'확정 수주금액'", "key==='won'?'준공 처리금액'");
fs.writeFileSync(path,s);

