/* I-4 nodes and inline styles are copied from the user-approved guide42-screens.json.
   Data binding only; retry/resume remains in the existing save controller. */
(function(root){
 'use strict';
 const SOURCE="<div style=\"width:375px;height:640px;background:#f5f6f8;border-radius:28px;border:8px solid #15171c;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box\">\n          <div style=\"height:56px;flex:none;background:#fff;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid #eef0f3\"><b style=\"font-size:17px\">오늘</b></div>\n          <div style=\"flex:none;padding:10px 16px;background:#fff4d6;font-size:13px;color:#8a5a00;display:flex;justify-content:space-between\"><span>연결 안 됨 · 기록 2건 보관 중</span><b>보기</b></div>\n          <div style=\"flex:1;padding:14px 16px;display:flex;flex-direction:column;gap:10px\">\n            <b style=\"font-size:14px\">전송 대기</b>\n            <div style=\"background:#fff;border:1px solid #e8eaef;border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;gap:4px\"><div style=\"display:flex;justify-content:space-between\"><b style=\"font-size:14px\">[화성] 동탄푸른마을</b><span style=\"font-size:12px;font-weight:700;color:#8a5a00\">대기</span></div><span style=\"font-size:12.5px;color:#6b7280\">방문 결과 · 견적 요청 · 14:42 작성</span></div><div style=\"background:#fff;border:1px solid #e8eaef;border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;gap:4px\"><div style=\"display:flex;justify-content:space-between\"><b style=\"font-size:14px\">[김포] 한강반도유보라</b><span style=\"font-size:12px;font-weight:700;color:#8a5a00\">대기</span></div><span style=\"font-size:12.5px;color:#6b7280\">통화 부재 · 내일 재연락 · 15:10</span></div><div style=\"background:#fff;border:1px solid #e8eaef;border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;gap:4px\"><div style=\"display:flex;justify-content:space-between\"><b style=\"font-size:14px\">[송파] 서울체육고</b><span style=\"font-size:12px;font-weight:700;color:#b42318\">사진 다시</span></div><span style=\"font-size:12.5px;color:#6b7280\">사진 3장만 실패 · 기록은 저장됨</span></div>\n            <span style=\"font-size:12.5px;color:#6b7280;line-height:1.5\">연결되면 자동으로 다시 보냄 · 같은 기록 두 번 만들지 않음 · 사진만 실패하면 사진만 다시</span>\n          </div>\n        </div>";
 const states={pending:'대기',failed:'확인 필요',conflict:'변경 충돌',partial:'일부 저장됨',done:'저장됨'};
 const labels={activity:'응대 기록',schedule:'후속 일정','schedule-note':'변경 사유','admin-request':'관리자 요청',refresh:'저장 결과 조회','customer-info':'고객 정보',close:'종결 기록','inquiry-progress':'문의 진행'};
 function source(){const box=root.document.createElement('div');box.innerHTML=SOURCE;return box;}
 function action(node,name){node.dataset.gs=name;node.setAttribute('role','button');node.tabIndex=0;}
 function bannerText(s){
  if(!s?.ok)return '저장 상태 확인 필요';
  if(s.count>0)return (root.navigator?.onLine===false?'연결 안 됨':'저장 확인 필요')+' · 기록 '+s.count+'건 보관 중';
  if(s.unlinked_operations>0)return '저장 요청 '+s.unlinked_operations+'개 · 기록 연결 확인 필요';
  return '전송 대기 기록 없음';
 }
 function bindBanner(node,s){node.firstElementChild.textContent=bannerText(s);action(node.lastElementChild,'pending');return node;}
 function banner(snapshot){return bindBanner(source().firstElementChild.children[1],snapshot).outerHTML;}
 function description(g){
  const parts=Array.isArray(g.parts)?g.parts:[],done=[...new Set(parts.filter(p=>p.state==='done').map(p=>labels[p.kind]||'저장'))],left=[...new Set(parts.filter(p=>p.state!=='done').map(p=>labels[p.kind]||'저장'))];
  const pieces=[];if(done.length)pieces.push(done.join(' · ')+' 저장됨');if(left.length)pieces.push(left.join(' · ')+' 확인 대기');
  if(!pieces.length)pieces.push(g.activity_type||'저장 상태 확인');
  if(g.recorded_at&&Number.isFinite(Date.parse(g.recorded_at))){pieces.push(new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(g.recorded_at))+' 작성');}
  if(!g.resume?.allowed&&g.resume?.reason==='target-not-loaded')pieces.push('현재 목록에서 대상 확인 필요');
  return pieces.join(' · ');
 }
 function render(snapshot,options){
  const s=snapshot||{ok:false},opt=options||{},box=source(),frame=box.firstElementChild,[head,bannerNode,body]=frame.children;
  frame.className='approved-i4';action(head,'tab');head.dataset.tab='today';bindBanner(bannerNode,s);
  const sample=body.children[1].cloneNode(true),hint=body.lastElementChild;
  [...body.children].slice(1,-1).forEach(n=>n.remove());
  const rows=s.ok?(s.groups||[]).filter(g=>g.pending):[];
  const pg=root.ListPager?.cut?root.ListPager.cut(rows,opt.page||1):{rows:rows.slice(0,20),pages:1};
  for(const g of pg.rows){
   const row=sample.cloneNode(true),top=row.firstElementChild;
   const names=opt.names||{},name=typeof names==='function'?names(g):names[g.target_id];
   top.firstElementChild.textContent=name||'대상 확인 필요';top.lastElementChild.textContent=states[g.state]||'확인 필요';
   top.lastElementChild.style.color=['conflict','failed'].includes(g.state)?'#b42318':'#8a5a00';
   row.lastElementChild.textContent=description(g);
   if(g.resume?.allowed){action(row,'recover');row.dataset.id=g.target_id;row.dataset.kind=g.kind;}
   body.insertBefore(row,hint);
  }
  if(pg.pages>1&&root.ListPager?.html){const wrap=root.document.createElement('div');wrap.innerHTML=root.ListPager.html(pg,{ns:'pending',unit:'건'});body.insertBefore(wrap,hint);}
  // Scroll only the original list region; the original geometry and card styling stay intact.
  body.style.overflowY='auto';
  hint.textContent=!s.ok?'보관된 기록을 읽지 못했습니다. 저장 상태를 확인한 뒤 다시 열어 주세요.':
   s.unlinked_operations>0?'기록과 연결되지 않은 저장 요청 '+s.unlinked_operations+'개는 별도 확인이 필요합니다. 보관 기록 수에 더하지 않습니다.':
   rows.length?'기록을 열어 남은 저장을 확인합니다. 이미 저장된 부분은 다시 만들지 않습니다.':'전송 대기 중인 기록이 없습니다.';
  return box.innerHTML;
 }
 root.MobilePendingView=Object.freeze({render,banner});
})(typeof window==='object'?window:globalThis);
