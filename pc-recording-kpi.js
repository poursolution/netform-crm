/* 기록률 KPI (2026-10-01 컨설턴트 영업 관점 13항 — "첫 2주는 기록률만 KPI로")
   관리팀 KPI 화면 아래에 담당자별 기록률 3개를 이번 주·지난주로 보여 준다. 집계만 하고 저장하지 않는다.
   · 첫 연락 기록률: 최근 14일 배정 문의 중 첫 연락 기록이 있는 비율
   · 활동 기록률: 진행 영업건 중 최근 7일 활동(전화·방문·단계 변경 등)이 기록된 비율
   · 다음 할 일 등록률: 진행 영업건 중 다음 할 일(내용+날짜)이 있는 비율 */
(function(root){
 'use strict';
 const DAY=864e5,h=v=>root.esc?root.esc(String(v??'')):String(v??'');
 function acts(d){const p=root.itemPatch?root.itemPatch(d,'deal')||{}:{};return [].concat(d.activities||[],p.activities||[],d.stage_history||[],p.stageHistory||[]);}
 function actAt(x){return Date.parse(x&&(x.at||x.occurred_at||x.created_at||x.changed_at)||'');}
 function nextOk(d){try{const a=root.actionObj(d,root.itemPatch(d,'deal'));return !!(a&&a.text&&(a.due||a.due_at));}catch(e){return false;}}
 function stats(name,offsetDays){
  const end=Date.now()-offsetDays*DAY,start=end-7*DAY;
  const D=(root.targetDeals?root.targetDeals(name):[]);
  const Q=(root.operationalInquiries?root.operationalInquiries(root.B?.inquiries||[]):[]).filter(q=>{const at=Date.parse(root.inquiryAssignedAt(q)||'');return at&&at>=end-14*DAY&&at<end&&(!name||name==='전체'||root.repN(root.inquiryRoutedOwner?.(q)||q.assignee)===name);});
  const first=Q.filter(q=>root.inqCtlFirstResponseAt&&root.inqCtlFirstResponseAt(q));
  const active=D.filter(d=>acts(d).some(x=>{const t=actAt(x);return t>=start&&t<end;}));
  const next=offsetDays?null:D.filter(nextOk);
  const pct=(a,b)=>b?Math.round(a*100/b):null;
  return {deals:D.length,inq:Q.length,first:pct(first.length,Q.length),activity:pct(active.length,D.length),next:next?pct(next.length,D.length):null,firstN:first.length,activeN:active.length,nextN:next?next.length:null};
 }
 function cell(now,prev,target){if(now===null)return '<td class="rk-na">대상 없음</td>';const cls=now>=target?'rk-ok':now>=target-20?'rk-warn':'rk-bad',delta=prev===null||prev===undefined||now===prev?'':' <small>'+(now>prev?'▲':'▼')+Math.abs(now-prev)+'</small>';return '<td class="'+cls+'"><b>'+now+'%</b>'+delta+'</td>';}
 function panel(){
  const names=(root.PERFORMANCE_TARGET_NAMES||[]).slice();if(!names.length)return '';
  const rows=names.map(n=>{const a=stats(n,0),b=stats(n,7);return '<tr><th>'+h(n)+'</th><td>'+a.deals+'</td>'+cell(a.first,b.first,70)+cell(a.activity,b.activity,70)+cell(a.next,null,70)+'</tr>';}).join('');
  const all=stats('전체',0),allPrev=stats('전체',7);
  return '<section class="panel rk-panel"><div class="panel-title">기록률 <span>첫 2주 핵심 지표 · 목표 70% · ▲▼ 지난주 대비</span></div>'
   +'<div class="rk-sum"><div><span>첫 연락 기록률</span><b>'+(all.first===null?'—':all.first+'%')+'</b><small>최근 14일 배정 '+all.inq+'건 중 '+all.firstN+'건</small></div><div><span>활동 기록률</span><b>'+(all.activity===null?'—':all.activity+'%')+'</b><small>진행 '+all.deals+'건 중 7일 내 기록 '+all.activeN+'건'+(allPrev.activity!==null?' · 지난주 '+allPrev.activity+'%':'')+'</small></div><div><span>다음 할 일 등록률</span><b>'+(all.next===null?'—':all.next+'%')+'</b><small>진행 '+all.deals+'건 중 '+all.nextN+'건</small></div></div>'
   +'<div class="tblwrap"><table class="opstable rk-table"><thead><tr><th>담당자</th><th>진행</th><th>첫 연락 기록</th><th>활동 기록(7일)</th><th>다음 할 일</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
   +'<p class="rk-note">기록률이 70%를 넘기 전까지 매출·정체 지표는 참고용입니다 — 기록이 없으면 "조치 필요"가 전부 허수가 됩니다.</p></section>';
 }
 function style(){if(document.getElementById('rk-style'))return;const s=document.createElement('style');s.id='rk-style';s.textContent='.rk-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:6px 0 12px}.rk-sum>div{background:#fff;border:1px solid #e2e8f1;border-radius:12px;padding:12px 14px}.rk-sum span{display:block;font-size:11.5px;color:#596579;font-weight:700}.rk-sum b{display:block;font-size:22px;font-weight:900;margin-top:4px;font-variant-numeric:tabular-nums}.rk-sum small{display:block;font-size:11.5px;color:#727E91;margin-top:3px}.rk-table td{font-variant-numeric:tabular-nums}.rk-table td small{color:#727E91;font-weight:700;margin-left:4px}.rk-ok b{color:#15AA72}.rk-warn b{color:#C77A10}.rk-bad b{color:#F04452}.rk-na{color:#8a97ab;font-size:12px}.rk-note{font-size:12px;color:#596579;margin:10px 0 0}@media(max-width:760px){.rk-sum{grid-template-columns:1fr}}';document.head.append(s);}
 function mount(){const rootEl=document.getElementById('mgmt-root');if(!rootEl||rootEl.querySelector('.rk-panel'))return;style();const html=panel();if(!html)return;const sec=document.createElement('div');sec.innerHTML=html;rootEl.append(sec.firstChild);}
 function boot(){const orig=root.paintMgmt;if(typeof orig!=='function')return;root.paintMgmt=function(){const r=orig.apply(this,arguments);try{mount();}catch(e){}return r;};}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.RecordingKPI={stats,panel};
})(window);
