/* 공법견적 · 간단견적 작성 (2026-10-11 design_handoff_quote_v3 6단계) — 영업건 상세 가운데 칸 '견적 작성' (자료 구역 [견적 작성] · [‹] 로 복귀)
   · 공법견적: 공법 + 수량(㎡) 줄들 + 기준에 없는 '간단 항목' → 직접공사비 → 원가계산서 → 적산 기준금액. 계산은 QuoteCompose(quote-compose.js) 한 곳,
     서버(crm_quote_version_save_v1)가 같은 순서로 다시 계산해 다르면 저장하지 않는다. 일반관리비 · 이윤은 정해진 요율이 없다(금액 맞추기용 입력).
   · 간단견적: 항목 · 수량 · 단위 · 단가 → 합계(원가계산서 없음).
   · [견적 확정] = 담당자가 확정(대표 2026-10-11) → 새 수정본(Vn+1). 가산 → 고객 제출금액은 이어서 [제출금액 만들기].
   · 승인된 기준(공법 · 자재 · 노임 · 요율)은 서버 목록에서 견적일에 맞는 것을 고른다. 기준이 없으면 계산하지 않고 이유를 보여 준다. 초안은 서버에 저장하지 않는다. */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc?R.esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),attr=h;
 const fmt=n=>Number(n||0).toLocaleString('ko-KR');
 const today=()=>new Date(Date.now()+9*36e5).toISOString().slice(0,10);
 let STD=null,STD_AT=0;
 function style(){
  if(document.getElementById('qc-style'))return;const s=document.createElement('style');s.id='qc-style';
  s.textContent='.qc{padding:4px 2px 14px}.qc h4{margin:14px 0 6px;font-size:12px;color:var(--sub);letter-spacing:.02em}.qc-tabs{display:flex;gap:6px}.qc-tabs button{border:1px solid var(--line-2);border-radius:999px;background:#fff;padding:6px 14px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer}.qc-tabs button[aria-pressed=true]{background:var(--ink);color:#fff;border-color:var(--ink)}'
   +'.qc-chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.qc-chips i{font-style:normal;border-radius:999px;background:#eef2f7;color:var(--ink-2);padding:3px 9px;font-size:11px;font-weight:800}'
   +'.qc-row{display:grid;grid-template-columns:minmax(120px,1.4fr) 90px 28px;gap:6px;align-items:center;margin-bottom:6px}.qc-row.x{grid-template-columns:minmax(110px,1.5fr) 62px 54px 90px 28px}.qc-row.s{grid-template-columns:minmax(120px,1.6fr) 64px 54px 96px 90px 28px}'
   +'.qc input,.qc select{border:1px solid var(--line-2);border-radius:8px;padding:7px 8px;font:inherit;font-size:12.5px;min-width:0;width:100%;box-sizing:border-box}.qc .rm{border:0;background:transparent;color:var(--sub);cursor:pointer;font-size:15px}.qc .add{border:1px dashed var(--line-2);border-radius:8px;background:#fff;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;color:var(--blue)}'
   +'.qc-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:6px}.qc-opts label{display:block;font-size:11px;color:var(--sub);margin-bottom:3px}.qc-opts .chk{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-2)}.qc-opts .chk input{width:auto}'
   +'.qc-res{margin-top:12px;border:1px solid var(--line);border-radius:12px;background:#f8fafd;padding:12px}.qc-res .big{font-size:18px;font-weight:900}.qc-res table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}.qc-res td{padding:4px 0;border-bottom:1px solid var(--line)}.qc-res td:last-child{text-align:right;font-variant-numeric:tabular-nums}.qc-warn{margin-top:8px;padding:8px 10px;border:1px solid #f6d9b0;border-left:4px solid #e08a00;border-radius:8px;background:#fffaf2;color:#8a4b00;font-size:12px;line-height:1.55}.qc-warn li{margin-left:16px}'
   +'.qc-act{display:flex;gap:8px;margin-top:12px;align-items:center}.qc-msg{margin-top:8px;font-size:12.5px}.qc-msg.cae{color:var(--danger)}.qc-msg.cao{color:var(--ok)}';
  document.head.append(s);
 }
 function loadStd(force){
  if(!force&&STD&&Date.now()-STD_AT<60000)return Promise.resolve(STD);
  const sb=R.SB;if(!sb||typeof sb.rpc!=='function')return Promise.reject(new Error('서버에 연결된 상태에서만 쓸 수 있습니다'));
  return Promise.resolve(sb.rpc('crm_cost_standard_list_v1',{p:{}})).then(r=>{if(r&&r.error)throw new Error(r.error.message||'기준을 불러오지 못했습니다');if(!r||!r.data||r.data.ok!==true)throw new Error('기준을 불러오지 못했습니다');STD=r.data;STD_AT=Date.now();return STD;});
 }
 const num=v=>{const n=Number(String(v==null?'':v).replace(/,/g,''));return Number.isFinite(n)?n:0;};
 function mount(host,d){
  style();
  const st={mode:'method',items:[{method:'',area:''}],extras:[],gp:'',pp:'',dur:'',retire:false,simple:[{name:'',qty:'',unit:'',price:''}],memo:'',msg:null,busy:false,res:null};
  const methods=()=>[...new Set(((STD&&STD.method)||[]).filter(m=>m.status!=='draft').map(m=>m.method))];
  function input(){return {date:today(),items:st.items.filter(x=>x.method&&num(x.area)>0).map(x=>({method:x.method,area:num(x.area)})),extras:st.extras.map(x=>({name:x.name,qty:num(x.qty),unit:x.unit,price:num(x.price)})),generalPct:num(st.gp)/100,profitPct:num(st.pp)/100,durationDays:st.dur===''?undefined:num(st.dur),retire:st.retire};}
  function compute(){
   if(!STD){st.res=null;return;}
   if(st.mode==='simple'){st.res=R.QuoteCompose.simple(st.simple);return;}
   st.res=R.QuoteCompose.compose(input(),STD);
  }
  function resultHtml(){
   const r=st.res;if(!r)return '<div class="qc-res">기준을 불러오는 중…</div>';
   if(st.mode==='simple'){
    return '<div class="qc-res"><div class="big">합계 '+fmt(r.total)+'원 <small style="font-size:11px;font-weight:700;color:var(--sub)">VAT 별도</small></div>'+(r.rows.length?'':'<div class="qc-warn">항목 · 수량 · 단가를 넣어 주세요</div>')+(r.rows.some(x=>!x.name)?'<div class="qc-warn">이름이 없는 항목이 있습니다</div>':'')+'</div>';
   }
   const s=r.sheet,rows=[['직접 재료비',s.directMaterial],['직접 노무비',s.directLabor],['경비 (잡재료비 · 공구손료)',s.expense],['간접노무비',s.indirectLabor],['보험료 · 부담금 · 기타경비 등',s.subtotalC-s.expense],['일반관리비',s.general],['이윤',s.profit]];
   return '<div class="qc-res"><div class="big">적산 기준금액 '+fmt(s.base)+'원 <small style="font-size:11px;font-weight:700;color:var(--sub)">VAT 별도 · 공급가액 '+fmt(s.supply)+'원에서 10만원 아래 절삭</small></div>'
    +(r.missing.length?'<div class="qc-warn">승인된 기준이 없어 계산할 수 없습니다 — 기준 담당이 [원가 기준]에서 올려야 합니다<ul>'+r.missing.slice(0,8).map(x=>'<li>'+h(x)+'</li>').join('')+'</ul></div>':'')
    +(r.rows.length?'<table>'+rows.map(x=>'<tr><td>'+x[0]+'</td><td>'+fmt(x[1])+'원</td></tr>').join('')+'</table>':'<div class="qc-warn">공법과 수량(㎡)을 넣어 주세요</div>')+'</div>';
  }
  function chipsHtml(){
   const b=(st.res&&st.res.basis)||{};const c=[['견적일',today()]];
   if(st.mode==='method'){[['공법',b.method],['자재',b.material],['노임',b.labor],['요율',b.cost]].forEach(x=>{if(x[1])c.push([x[0]+' 기준',x[1]]);});}
   return '<div class="qc-chips">'+c.map(x=>'<i>'+h(x[0])+' '+h(x[1])+'</i>').join('')+'</div>';
  }
  function render(){
   const ms=methods();let html='<div class="qc"><div class="qc-tabs"><button type="button" data-qc="mode" data-v="method" aria-pressed="'+(st.mode==='method')+'">공법견적</button><button type="button" data-qc="mode" data-v="simple" aria-pressed="'+(st.mode==='simple')+'">간단견적</button></div><div id="qc-chips">'+chipsHtml()+'</div>';
   if(st.msg&&!STD)html+='<div class="qc-msg cae">'+h(st.msg.text)+'</div>';
   if(st.mode==='method'){
    html+='<h4>공법 · 수량(㎡)</h4>'+st.items.map((x,i)=>'<div class="qc-row"><select data-qc="im" data-i="'+i+'"><option value="">공법 선택</option>'+ms.map(m=>'<option value="'+attr(m)+'"'+(m===x.method?' selected':'')+'>'+h(m)+'</option>').join('')+'</select><input data-qc="ia" data-i="'+i+'" inputmode="decimal" placeholder="수량 ㎡" value="'+attr(x.area)+'"><button type="button" class="rm" data-qc="irm" data-i="'+i+'" aria-label="줄 지우기">✕</button></div>').join('')+'<button type="button" class="add" data-qc="iadd">+ 공법 추가</button>';
    if(STD&&!ms.length)html+='<div class="qc-warn">승인된 공법 기준이 없습니다. [원가 기준]에서 통합관리표를 올리고 승인해 주세요.</div>';
    html+='<h4>기준에 없는 항목 (간단 항목 · 재료비로 합산)</h4>'+st.extras.map((x,i)=>'<div class="qc-row x"><input data-qc="xn" data-i="'+i+'" placeholder="항목" value="'+attr(x.name)+'"><input data-qc="xq" data-i="'+i+'" inputmode="decimal" placeholder="수량" value="'+attr(x.qty)+'"><input data-qc="xu" data-i="'+i+'" placeholder="단위" value="'+attr(x.unit)+'"><input data-qc="xp" data-i="'+i+'" inputmode="decimal" placeholder="단가(원)" value="'+attr(x.price)+'"><button type="button" class="rm" data-qc="xrm" data-i="'+i+'" aria-label="줄 지우기">✕</button></div>').join('')+'<button type="button" class="add" data-qc="xadd">+ 간단 항목</button>';
    html+='<h4>조건</h4><div class="qc-opts"><div><label>공사기간(일) — 30일 미만이면 건강 · 연금 · 요양보험료 제외</label><input data-qc="dur" inputmode="numeric" placeholder="비우면 포함" value="'+attr(st.dur)+'"></div><div class="chk"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" data-qc="ret"'+(st.retire?' checked':'')+'> 퇴직공제부금비 넣기 (기본 제외)</label></div><div><label>일반관리비율 % (금액 맞추기용)</label><input data-qc="gp" inputmode="decimal" placeholder="예: 3" value="'+attr(st.gp)+'"></div><div><label>이윤율 % (금액 맞추기용)</label><input data-qc="pp" inputmode="decimal" placeholder="예: 12" value="'+attr(st.pp)+'"></div></div>';
   }else{
    html+='<h4>항목 · 수량 · 단위 · 단가</h4>'+st.simple.map((x,i)=>'<div class="qc-row s"><input data-qc="sn" data-i="'+i+'" placeholder="항목" value="'+attr(x.name)+'"><input data-qc="sq" data-i="'+i+'" inputmode="decimal" placeholder="수량" value="'+attr(x.qty)+'"><input data-qc="su" data-i="'+i+'" placeholder="단위" value="'+attr(x.unit)+'"><input data-qc="sp" data-i="'+i+'" inputmode="decimal" placeholder="단가(원)" value="'+attr(x.price)+'"><span class="n" style="text-align:right;font-size:12px" data-qc-amt="'+i+'"></span><button type="button" class="rm" data-qc="srm" data-i="'+i+'" aria-label="줄 지우기">✕</button></div>').join('')+'<button type="button" class="add" data-qc="sadd">+ 항목 추가</button>';
   }
   html+='<div id="qc-res">'+resultHtml()+'</div><div class="qc-opts" style="grid-template-columns:1fr"><div><label>메모(선택)</label><input data-qc="memo" maxlength="200" placeholder="예: 옥상 전체 · 바탕정리 별도" value="'+attr(st.memo)+'"></div></div>'
    +'<div class="qc-act"><button type="button" class="dact pri" data-qc="ok" id="qc-ok" disabled>견적 확정</button><span style="font-size:11.5px;color:var(--sub)">확정하면 새 수정본이 만들어집니다 · 이어서 [제출금액 만들기]로 가산</span></div><div id="qc-msg"></div></div>';
   host.innerHTML=html;refresh();
  }
  function refresh(){
   compute();const res=host.querySelector('#qc-res'),ch=host.querySelector('#qc-chips'),ok=host.querySelector('#qc-ok'),msg=host.querySelector('#qc-msg');
   if(res)res.innerHTML=resultHtml();if(ch)ch.innerHTML=chipsHtml();
   if(st.mode==='simple'&&st.res)host.querySelectorAll('[data-qc-amt]').forEach(n=>{const x=st.res.rows[+n.dataset.qcAmt];n.textContent='';const it=st.simple[+n.dataset.qcAmt],a=Math.floor(num(it.qty)*num(it.price));n.textContent=a>0?fmt(a)+'원':'';});
   const can=!!st.res&&st.res.ok&&!st.busy;if(ok)ok.disabled=!can;
   if(msg)msg.innerHTML=st.msg&&STD?'<div class="qc-msg '+st.msg.cls+'" role="status">'+h(st.msg.text)+'</div>':'';
  }
  async function confirm(){
   compute();const r=st.res;if(!r||!r.ok)return;const sb=R.SB;if(!sb||typeof sb.rpc!=='function'){st.msg={text:'서버에 연결된 상태에서만 확정할 수 있습니다',cls:'cae'};refresh();return;}
   const base=st.mode==='simple'?r.total:r.sheet.base;
   const payload=st.mode==='simple'?{deal_id:String(d.id),kind:'simple',simple_items:r.rows.map(x=>({name:x.name,qty:x.qty,unit:x.unit,price:x.price})),expected_base:base,memo:st.memo}
    :Object.assign({deal_id:String(d.id),kind:'method',expected_base:base,memo:st.memo},input());
   st.busy=true;st.msg=null;refresh();
   try{
    const resp=await sb.rpc('crm_quote_version_save_v1',{p:payload});if(resp&&resp.error)throw new Error(resp.error.message||'저장하지 못했습니다');const o=resp&&resp.data;if(!o||o.ok!==true)throw new Error('서버 응답을 확인하지 못했습니다');
    const p=R.itemPatch(d,'deal'),A=R.execQuoteVersions(d),row={version_no:o.version_no,amount:o.amount,base_amount:o.base_amount,kind:o.kind,reason:o.reason,created_at:o.server_at||R.isoNow(),created_by:(typeof ME!=='undefined'&&ME&&ME.name)||''};
    d.quote_versions=p.quoteVersions=A.concat([row]);d.quote_amount=p.quoteAmt=o.amount;try{R.saveLocal();}catch(e){}
    const back=document.querySelector('#detailView [data-dv3="p7close"]');if(back)back.click();/* 지금 응대 중심(dv8): 자료는 가운데 패널 — 확정 뒤 자료 목록으로 돌아가 새 수정본을 보여 준다 */if(document.querySelector('#detailView.dv8')&&R.DealDetailV3&&R.DealDetailV3.openPanel){try{R.DealDetailV3.openPanel('files');}catch(e){}}
    R.renderDetail();R.showDetailErr&&R.showDetailErr('견적 V'+o.version_no+'을 확정했습니다 — '+fmt(o.amount)+'원 (VAT 별도). 이어서 [제출금액 만들기]로 가산할 수 있습니다.',true);
   }catch(e){st.busy=false;st.msg={text:String(e&&e.message||e),cls:'cae'};refresh();}
  }
  host.addEventListener('click',e=>{const b=e.target.closest('[data-qc]');if(!b)return;const a=b.dataset.qc,i=+b.dataset.i;
   if(a==='mode'){st.mode=b.dataset.v;st.msg=null;render();}
   else if(a==='iadd'){st.items.push({method:'',area:''});render();}else if(a==='irm'){st.items.splice(i,1);if(!st.items.length)st.items.push({method:'',area:''});render();}
   else if(a==='xadd'){st.extras.push({name:'',qty:'',unit:'',price:''});render();}else if(a==='xrm'){st.extras.splice(i,1);render();}
   else if(a==='sadd'){st.simple.push({name:'',qty:'',unit:'',price:''});render();}else if(a==='srm'){st.simple.splice(i,1);if(!st.simple.length)st.simple.push({name:'',qty:'',unit:'',price:''});render();}
   else if(a==='ok')confirm();
  });
  host.addEventListener('input',e=>{const t=e.target,a=t.dataset.qc,i=+t.dataset.i;if(!a)return;
   if(a==='ia')st.items[i].area=t.value;else if(a==='xn')st.extras[i].name=t.value;else if(a==='xq')st.extras[i].qty=t.value;else if(a==='xu')st.extras[i].unit=t.value;else if(a==='xp')st.extras[i].price=t.value;
   else if(a==='sn')st.simple[i].name=t.value;else if(a==='sq')st.simple[i].qty=t.value;else if(a==='su')st.simple[i].unit=t.value;else if(a==='sp')st.simple[i].price=t.value;
   else if(a==='dur')st.dur=t.value;else if(a==='gp')st.gp=t.value;else if(a==='pp')st.pp=t.value;else if(a==='memo')st.memo=t.value;else return;
   refresh();});
  host.addEventListener('change',e=>{const t=e.target,a=t.dataset.qc,i=+t.dataset.i;if(a==='im'){st.items[i].method=t.value;refresh();}else if(a==='ret'){st.retire=t.checked;refresh();}});
  render();
  loadStd().then(()=>{render();}).catch(e=>{st.msg={text:String(e.message||e),cls:'cae'};render();});
 }
 R.QuoteComposer={mount,reset(){STD=null;STD_AT=0;},_std(){return STD;}};
})(window);
