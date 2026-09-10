(function(root){
 'use strict';

 function objectOf(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
 function firstText(values){
  for(var i=0;i<values.length;i++){
   var value=values[i];
   if(value!==null&&value!==undefined&&String(value).trim())return String(value).trim();
  }
  return '';
 }
 function normalizedOwnerName(value){
  var name=firstText([value]);
  if(!name)return '';
  if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name))return '';
  name=typeof root.repN==='function'?root.repN(name):name;
  return /^(미배정|중복|중복건|없음|null|undefined|담당자 배정|배정완료)$/i.test(name)?'':name;
 }
 function userNameForId(id){
  id=firstText([id]);if(!id)return '';
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))return normalizedOwnerName(id);
  var rows=[];
  if(root.B){rows=rows.concat(root.B.users||[],root.B.sales_people||[],root.B.salesPeople||[])}
  rows=rows.concat(root.SALES_PEOPLE_MASTER||[]);
  for(var i=0;i<rows.length;i++)if(String(rows[i].user_id||rows[i].id||'')===id)return normalizedOwnerName(rows[i].name||rows[i].display_name||rows[i].full_name);
  return '';
 }
 function directOwnerIdentity(q){
  q=objectOf(q);var detail=objectOf(q.detail),raw=objectOf(q.raw||q.data),id=firstText([q.assigned_to,q.assignee_id,q.assigneeId,q.owner_id,q.ownerId,q.sales_rep_id,q.salesRepId]),name=firstText([
   q.assignee_name,q.sales_assignee,q.salesAssignee,q.assignee,q.owner_name,q.ownerName,q.owner,q.sales_rep_name,q.salesRepName,q.sales_rep,q.salesRep,
   detail.assignee_name,detail.sales_assignee,detail.owner_name,detail.sales_rep_name,detail['영업담당자'],detail['영업담당'],detail['배정담당자'],
   raw.assignee_name,raw.sales_assignee,raw.owner_name,raw.sales_rep_name,raw['영업담당자'],raw['영업담당'],raw['배정담당자'],raw['담당자명'],raw['담당자']
  ]);
  name=normalizedOwnerName(name)||userNameForId(id);
  return {id:id,name:name,assigned:!!(id||name),source:id?'assigned_to':name?'owner_name':''};
 }
 function latestHistoryOwner(q){
  var rows=assignmentHistory(q),latest=rows[0]||{},name=normalizedOwnerName(latest.to_owner||latest.to||latest.to_assignee);
  return name?{id:'',name:name,assigned:true,source:'assignment_history'}:{id:'',name:'',assigned:false,source:rows.length?'assignment_history':''};
 }
 function queueHasLiveAssignment(key){
  try{return !!(root.Phase1&&root.Phase1.queue&&root.Phase1.queue.list().some(function(row){return row.operation==='inquiry_assign'&&String(row.object_id||row.payload&&row.payload.inquiry_id||'')===String(key)&&['queued','pending','sending','processing'].indexOf(String(row.status||'').toLowerCase())>=0}))}catch(error){return false}
 }
 root.inquiryDirectOwnerIdentity=directOwnerIdentity;
 root.inquiryQueueHasLiveAssignment=queueHasLiveAssignment;
 root.mergeInquiryAssignmentTruth=function(q,patch,key){
  q=objectOf(q);patch=objectOf(patch);key=key||q.id||q.inquiry_id||'';
  var previous=objectOf(q._assignmentServerTruth),freshSeen=['assigned_to','assignee_name','assignment_history'].some(function(field){return Object.prototype.hasOwnProperty.call(q,field)}),fresh=directOwnerIdentity(q),server=previous.seen?previous:fresh,seen=previous.seen||freshSeen,history=Array.isArray(q.assignment_history)?q.assignment_history:null;
  Object.assign(q,patch);
  q._assignmentServerTruth={seen:seen,assigned:server.assigned,id:server.id||'',name:server.name||''};
  if(seen&&server.assigned){q.assigned_to=server.id||null;q.assignee_name=server.name||userNameForId(server.id)||'';q.assignee=q.assignee_name||server.id;q._assignmentOptimistic=false}
  else if(seen&&!server.assigned&&!queueHasLiveAssignment(key)){q.assigned_to=null;q.assignee_name='';q.assignee='';q.sales_assignee='';q.salesAssignee='';q._assignmentOptimistic=false}
  if(history){q.assignment_history=history;q.assignmentHistory=history}
  return q;
 };
 function assignmentHistory(q){
  var patch=typeof root.itemPatch==='function'?root.itemPatch(q,'inq'):{};
  var lists=[q&&q.assignmentHistory,q&&q.assignment_history,patch&&patch.assignmentHistory,patch&&patch.assignment_history];
  var seen={},rows=[];
  lists.forEach(function(list){
   if(!Array.isArray(list))return;
   list.forEach(function(row,index){
    row=objectOf(row);
    var key=firstText([row.id,row.assignment_history_id,row.changed_at,row.at])+':'+firstText([row.to_owner,row.to,row.to_assignee])+':'+index;
    if(!seen[key]){seen[key]=1;rows.push(row)}
   });
  });
  return rows.sort(function(a,b){return String(b.changed_at||b.at||'').localeCompare(String(a.changed_at||a.at||''))});
 }

 root.inquiryOwnerIdentity=function(q){
  q=objectOf(q);
  if(q._assignmentOptimistic){var optimistic=directOwnerIdentity(q);if(optimistic.assigned)return optimistic}
  var truth=objectOf(q._assignmentServerTruth);
  if(truth.seen){
   if(truth.assigned)return {id:truth.id||'',name:truth.name||userNameForId(truth.id)||'담당자 정보 확인',assigned:true,source:'server'};
   if(!queueHasLiveAssignment(typeof root.inqKey==='function'?root.inqKey(q):q.id))return {id:'',name:'',assigned:false,source:'server'};
  }
  var direct=directOwnerIdentity(q);if(direct.assigned)return direct;
  return latestHistoryOwner(q);
 };
 root.inquiryRecordedOwner=function(q){return root.inquiryOwnerIdentity(q).name};
 root.inquirySalesOwner=function(q){var name=root.inquiryOwnerIdentity(q).name,profile=name&&root.repProfile?root.repProfile(name):{};return name&&profile.active&&profile.salesRep&&profile.role!=='branch_pool'?name:''};
 root.inquiryRoutedOwner=function(q){return root.inquiryOwnerIdentity(q).name};
 root.inquiryAssigned=function(q){return root.inquiryOwnerIdentity(q).assigned};

 function contactToken(q){
  var detail=objectOf(q.detail),raw=objectOf(q.raw||q.data),phone=firstText([q.phone,q.mobile,q.contact_phone,detail.phone,detail.mobile,raw.phone,raw.mobile,raw['연락처'],raw['전화번호']]).replace(/\D/g,'');
  if(phone.length>=8)return 'p:'+phone;
  var contact=firstText([q.contact_name,q.contact,detail.contact_name,detail.contact,raw['고객명'],raw['성함'],raw['이름']]).replace(/\s+/g,'').toLowerCase();
  return contact.length>=2?'n:'+contact:'';
 }
 function duplicateBase(q){
  var contact=contactToken(q),site=firstText([q.site_name,q.site]).replace(/^\[[^\]]+\]\s*/,'');
  site=typeof root.normSite==='function'?root.normSite(site):site.replace(/\s+/g,'').toLowerCase();
  if(!contact||!site)return '';
  var brand=firstText([q.brand,q.business_type]).replace(/\s+/g,'').toLowerCase(),work=typeof root.inqCtlWorkLabel==='function'?root.inqCtlWorkLabel(q):firstText([q.work_type,q.work]);
  var closed=typeof root.isClosedInq==='function'&&root.isClosedInq(q)?'closed':'active';
  return [closed,contact,site,brand,String(work||'').replace(/\s+/g,'').toLowerCase()].join('|');
 }
 function inquiryTime(q){var value=new Date(receivedAt(q)).getTime();return Number.isFinite(value)?value:null}
 function winnerScore(q){var identity=root.inquiryOwnerIdentity(q),score=identity.assigned?100:0;score+=identity.id?20:0;score+=firstText([q.responded_at,q.first_response_at])?10:0;score+=assignmentHistory(q).length?5:0;return score}
 root.inquiryCanonicalRows=function(list){
  var groups={},result=[];
 (list||[]).forEach(function(q){
   var base=duplicateBase(q),time=inquiryTime(q),group=null;
   if(base){groups[base]=groups[base]||[];group=groups[base].filter(function(candidate){return time!==null&&candidate.time!==null&&Math.abs(time-candidate.time)<=24*60*60*1000})[0]}
   if(!group){group={time:time,winner:q,index:result.length,rows:[q]};result.push(q);if(base)groups[base].push(group);return}
   group.rows.push(q);
   var current=group.winner,nextScore=winnerScore(q),currentScore=winnerScore(current);
   if(nextScore>currentScore||(nextScore===currentScore&&String(q.updated_at||q.updated||'')>String(current.updated_at||current.updated||''))){group.winner=q;result[group.index]=q}
  });
  Object.keys(groups).forEach(function(base){groups[base].forEach(function(group){if(group.rows.length>1)group.winner._canonicalDuplicateIds=group.rows.map(function(q){return String(q.id||q.inquiry_id||'')}).filter(Boolean)})});
  return result;
 };
 var originalOperationalInquiries=root.operationalInquiries||function(list){return list||[]};
 root.operationalInquiries=function(list){return root.inquiryCanonicalRows(originalOperationalInquiries(list))};

 /* 저장 직후에는 서버 재조회보다 화면 갱신이 먼저 일어난다. 그 짧은 구간에만
    새 담당자를 정본보다 우선해 배정·재배정 결과를 즉시 보여준다. */
 var originalRecordAssignment=root.inqCtlRecordAssignment;
 if(typeof originalRecordAssignment==='function')root.inqCtlRecordAssignment=function(q,to,reason,intent){
  var requestId=originalRecordAssignment(q,to,reason,intent),current=directOwnerIdentity(q),expected=normalizedOwnerName(to);
  if(current.assigned&&(!expected||current.name===expected||String(current.id)===String(to)))q._assignmentOptimistic=true;
  if(typeof root.setTimeout==='function')root.setTimeout(function(){
   var modal=objectOf(root.INQ_CTL_MODAL),key=typeof root.inqKey==='function'?root.inqKey(q):q.id;
   if((modal.keys||[]).map(String).indexOf(String(key))>=0&&typeof root.closeInquiryControlModal==='function')root.closeInquiryControlModal();
   if(root.G&&root.G.page==='today'&&typeof root.paintTodayHome==='function')root.paintTodayHome();
  },0);
  return requestId;
 };
 function receivedAt(q){return root.inquiryCreatedAt(q)||q.received_at||q.created_at||q.at||''}
 function elapsed(q){
  var at=receivedAt(q),time=new Date(at).getTime();
  if(!at||!Number.isFinite(time))return {minutes:null,label:'경과 미확인'};
  var minutes=Math.max(0,Math.floor((Date.now()-time)/60000));
  if(minutes<60)return {minutes:minutes,label:minutes+'분'};
  var hours=Math.floor(minutes/60);
  if(hours<24)return {minutes:minutes,label:hours+'시간'};
  return {minutes:minutes,label:'D+'+Math.floor(hours/24)};
 }
 function evidence(q){
  var patch=typeof root.itemPatch==='function'?objectOf(root.itemPatch(q,'inq')):{},detail=objectOf(q&&q.detail),raw=objectOf(q&&(q.raw||q.data)),parents=[objectOf(q),patch,detail,raw],nested=[objectOf(q&&q.assignment_sync),objectOf(q&&q.assignmentSync),objectOf(q&&q.assignment_attempt),objectOf(q&&q.assignmentAttempt),objectOf(detail.assignment_sync),objectOf(raw.assignment_sync)],codes=[],messages=[],statuses=[],attemptedAts=[];
  parents.forEach(function(o){
   codes.push(o.assignment_error_code,o.assignment_sync_error_code,o.sync_error_code);
   messages.push(o.assignment_failure_reason,o.assignment_error_message,o.assignment_sync_error,o.sync_error);
   statuses.push(o.assignment_status,o.assignment_sync_status,o.sync_status,o.assignment_attempt_status);
   attemptedAts.push(o.assignment_attempted_at,o.assignment_sync_attempted_at,o.sync_attempted_at,o.assignment_last_attempt_at);
  });
  nested.forEach(function(o){
   codes.push(o.error_code,o.code);
   messages.push(o.failure_reason,o.error_message,o.error,o.message);
   statuses.push(o.status,o.result);
   attemptedAts.push(o.attempted_at,o.last_attempt_at,o.at);
  });
  return {code:firstText(codes),message:firstText(messages),status:firstText(statuses),attemptedAt:firstText(attemptedAts)};
 }
 function errorLabel(code,message){
  var value=(String(code||'')+' '+String(message||'')).toUpperCase();
  if(/TARGET.*(NOT[_ ]?FOUND|AMBIGUOUS)|USER.*(NOT[_ ]?FOUND|AMBIGUOUS)/.test(value))return '담당자 계정 일치 실패';
  if(/INQUIRY.*(NOT[_ ]?FOUND|AMBIGUOUS)|MATCH.*(NOT[_ ]?FOUND|AMBIGUOUS)/.test(value))return '문의 매칭 실패';
  if(/EXISTING.*(UUID|OWNER).*PRESERV|CAS|STALE/.test(value))return '기존 담당자 보호로 동기화 거부';
  if(/UNAUTHORIZED|FORBIDDEN|SERVICE.*ROLE|PERMISSION/.test(value))return '배정 동기화 권한 실패';
  return '배정 동기화 실패';
 }
 function isFailure(status,code,message){return !!(code||message||/fail|error|reject|거부|실패/i.test(String(status||'')))}
 function isPending(status){return /^(pending|manual_pending|awaiting_assignment|assignment_pending|배정대기|수동배정대기)$/i.test(String(status||'').trim())}

 root.inquiryUnassignedMeta=function(q){
  var age=elapsed(q),history=assignmentHistory(q),latest=history[0]||{},to=firstText([latest.to_owner,latest.to,latest.to_assignee]),reason=firstText([latest.reason,latest.note]),at=firstText([latest.changed_at,latest.at]),ev=evidence(q);
  if(root.inquiryRoutedOwner(q))return {unassigned:false,elapsed:age,label:'배정완료',detail:'',attempted:false,attemptLabel:'배정 완료'};
  if((!to||/^(미배정|unassigned|none)$/i.test(to))&&history.length){
   return {unassigned:true,elapsed:age,code:'manual_unassign',label:'수동 회수',detail:reason||'회수 사유 미기록',attempted:true,attemptedAt:at,attemptLabel:'배정 후 회수'+(at?' · '+root.dateTimeLabel(at):'')};
  }
  if(isFailure(ev.status,ev.code,ev.message)){
   return {unassigned:true,elapsed:age,code:ev.code||'sync_failure',label:errorLabel(ev.code,ev.message),detail:ev.message||ev.code||'오류 상세 미기록',attempted:true,attemptedAt:ev.attemptedAt,attemptLabel:'배정 시도 실패'+(ev.attemptedAt?' · '+root.dateTimeLabel(ev.attemptedAt):'')};
  }
  if(isPending(ev.status)){
   return {unassigned:true,elapsed:age,code:'pending',label:'담당자 배정 대기',detail:'배정 대기 상태가 저장되어 있습니다.',attempted:!!ev.attemptedAt,attemptedAt:ev.attemptedAt,attemptLabel:ev.attemptedAt?'배정 시도 · '+root.dateTimeLabel(ev.attemptedAt):'배정 시도 전'};
  }
  return {unassigned:true,elapsed:age,code:'unrecorded',label:'사유 미기록 · 기존 데이터',detail:'배정 과정 기록이 없어 원인을 추정하지 않습니다.',attempted:false,attemptedAt:'',attemptLabel:'배정 시도 미기록'};
 };

 var originalAssignmentHistoryHTML=root.assignmentHistoryHTML;
 root.assignmentHistoryHTML=function(p,item){
  if(!root.CUR_DETAIL||root.CUR_DETAIL.kind!=='inq')return originalAssignmentHistoryHTML(p,item);
  var rows=assignmentHistory(item),owner=root.inquiryRoutedOwner(item),meta=owner?null:root.inquiryUnassignedMeta(item),received=receivedAt(item),assignedAt=root.inqCtlAssignedAt(item),status=owner?'배정완료':'미배정';
  var audit='<div class="inq-assignment-audit"><div><span>문의 접수</span><b>'+root.esc(received?root.dateTimeLabel(received):'접수시각 미기록')+'</b></div><div><span>배정 시도</span><b>'+root.esc(owner?(assignedAt?'배정 완료 · '+root.dateTimeLabel(assignedAt):'배정시각 미기록'):meta.attemptLabel)+'</b></div><div class="'+(owner?'':'risk')+'"><span>현재 결과</span><b>'+root.esc(status+(owner?' · '+root.repDisplay(owner):''))+'</b></div><div><span>근거·사유</span><b>'+root.esc(owner?'현재 담당자 UUID/이름 정본':meta.label)+'</b></div></div>';
  if(!rows.length)return audit+'<div class="historytbl"><div class="historyrow head"><span>변경일</span><span>담당자</span><span>처리</span></div><div class="historyrow"><span>—</span><b>'+root.esc(owner?root.repDisplay(owner):'미배정')+'<small class="assignment-history-note">'+root.esc(owner?'배정 이력 미기록 · 기존 데이터':meta.detail)+'</small></b><span>이력 미기록</span></div></div>';
  return audit+'<div class="historytbl"><div class="historyrow head"><span>변경일</span><span>담당자</span><span>처리</span></div>'+rows.slice(0,12).map(function(history){var from=firstText([history.from_owner,history.from,history.from_assignee])||'—',to=firstText([history.to_owner,history.to,history.to_assignee])||'미배정',actor=firstText([history.actor_name,history.actor,history.changed_by])||'시스템',reason=firstText([history.reason,history.note]);return '<div class="historyrow"><span>'+root.esc(root.dateTimeLabel(history.changed_at||history.at))+'</span><b>'+root.esc(from)+' → '+root.esc(to)+(reason?'<small class="assignment-history-note">사유 · '+root.esc(reason)+'</small>':'')+'</b><span>'+root.esc(actor)+'</span></div>'}).join('')+'</div>';
 };

 root.inquiryAssignmentSort=function(a,b){
  var au=!root.inquiryRoutedOwner(a),bu=!root.inquiryRoutedOwner(b);
  if(au&&bu){
   var av=new Date(receivedAt(a)).getTime(),bv=new Date(receivedAt(b)).getTime();
   if(Number.isFinite(av)&&Number.isFinite(bv)&&av!==bv)return av-bv;
   if(Number.isFinite(av)!==Number.isFinite(bv))return Number.isFinite(av)?-1:1;
  }
  return String(root.inquiryDate(b)||'').localeCompare(String(root.inquiryDate(a)||''));
 };

 var originalTodayInquiryEntry=root.todayInquiryEntry;
 root.todayInquiryEntry=function(q){
  if(root.inquiryRoutedOwner(q))return originalTodayInquiryEntry(q);
  var meta=root.inquiryUnassignedMeta(q),minutes=meta.elapsed.minutes||0;
  return {key:'inq:'+root.inqKey(q),type:'inq',item:q,owner:root.inquiryConsultant(q)||'미배정',stage:'미배정',reason:'담당자 미배정 · '+meta.elapsed.label+' 경과',recent:root.todayRecent(q,'inq'),next:'영업담당자를 지정하고 문의를 인계',score:300,delay:minutes,tone:'critical',unassigned:true,assignmentReason:meta.label,assignmentDetail:meta.detail,assignmentAttempt:meta.attemptLabel};
 };
 root.todayInquiryFilterMatch=function(x,key){
  var reason=String(x.reason||'');
  if(key==='unassigned')return !!x.unassigned;
  if(key==='unanswered')return !x.unassigned&&/응대/.test(reason);
  if(key==='quote')return /견적 작성/.test(reason);
  if(key==='material')return /자료|핵심정보/.test(reason);
  if(key==='dispatch')return /견적 발송/.test(reason);
  if(key==='delayed')return /초과|지연|정체/.test(reason);
  return true;
 };
 root.todaySetInquiryFilter=function(value){root.G.todayInquiryFilter=['all','unassigned','unanswered','quote','material','dispatch','delayed'].indexOf(value)>=0?value:'all';root.paintTodayHome()};
 root.todayInquiryFilterBar=function(rows,active){
  var filters=[['all','전체'],['unassigned','미배정'],['unanswered','미응대'],['quote','견적대기'],['material','자료대기'],['dispatch','발송대기'],['delayed','지연']];
  return '<nav class="today-inquiry-toolbar" aria-label="견적문의 관리 필터">'+filters.map(function(filter){var count=rows.filter(function(x){return root.todayInquiryFilterMatch(x,filter[0])}).length;return '<button class="'+(active===filter[0]?'on':'')+'" data-filter="'+filter[0]+'" onclick="todaySetInquiryFilter(this.dataset.filter)">'+filter[1]+' '+count+'</button>'}).join('')+'</nav>';
 };
 root.todayInquiryKey=function(event,index){if(event.key==='Enter'||event.key===' '){event.preventDefault();root.todayOpenWork('admin-inquiry',index)}};
 root.todayAssignInquiry=function(key){if(!root.todayIsAdmin())return;root.inqCtlOpenAssign('assign',key)};
 root.todayInquiryRow=function(x){
  var q=x.item||{},index=root.TODAY_ADMIN_INQUIRY.indexOf(x),site=q.site||q.site_name||'현장명 미입력',created=receivedAt(q),createdLabel=created?root.dateTimeLabel(created):'미확인',meta=x.unassigned?root.inquiryUnassignedMeta(q):null,key=root.inqKey(q);
  var reason=x.unassigned?'<strong>'+root.esc(x.reason)+'</strong><small>사유 · '+root.esc(meta.label)+'</small><small class="assignment-attempt">'+root.esc(meta.attemptLabel)+'</small>':'<strong>'+root.esc(x.reason)+'</strong>';
  var action=x.unassigned?'<span>'+root.esc(x.next)+'</span><button class="today-inquiry-action" data-k="'+root.escAttr(key)+'" onclick="event.stopPropagation();todayAssignInquiry(this.dataset.k)">담당자 배정</button>':'<span>'+root.esc(x.next)+'</span><button class="today-inquiry-action secondary" onclick="event.stopPropagation();todayOpenWork(\'admin-inquiry\','+index+')">상세 확인</button>';
  return '<div class="today-inquiry-row '+x.tone+'" role="button" tabindex="0" onclick="todayOpenWork(\'admin-inquiry\','+index+')" onkeydown="todayInquiryKey(event,'+index+')"><span class="today-inquiry-cell site" data-label="현장"><strong>'+root.esc(site)+'</strong><small>'+root.esc(root.todayPriorityMeta(x))+'</small></span><span class="today-inquiry-cell owner" data-label="담당자">'+root.esc(x.owner)+'</span><span class="today-inquiry-cell received" data-label="유입일시">'+root.esc(createdLabel)+'</span><span class="today-inquiry-cell state" data-label="현재 상태">'+root.esc(x.stage)+'</span><span class="today-inquiry-cell reason" data-label="관리 필요 사유">'+reason+'</span><span class="today-inquiry-cell elapsed" data-label="경과">'+root.esc(root.todayInquiryElapsed(x))+'</span><span class="today-inquiry-cell action" data-label="바로 조치">'+action+'</span></div>';
 };
 root.todayInquiryBoard=function(title,desc,rows){
  var allowed=['all','unassigned','unanswered','quote','material','dispatch','delayed'],active=allowed.indexOf(root.G.todayInquiryFilter)>=0?root.G.todayInquiryFilter:'all',shown=rows.filter(function(x){return root.todayInquiryFilterMatch(x,active)});
  return '<section class="today-board inquiry"><header><div><span>📥 '+title+'</span><p>'+root.esc(desc)+' · 미배정은 오래된 건부터 원인과 즉시 조치를 함께 보여줍니다.</p></div><b>'+rows.length+'건</b></header>'+root.todayInquiryFilterBar(rows,active)+'<div class="today-board-list"><div class="today-inquiry-table"><div class="today-inquiry-head"><span>현장명</span><span>담당자</span><span>유입일시</span><span>현재 상태</span><span>관리 필요 사유</span><span>경과</span><span>바로 조치</span></div>'+(shown.map(root.todayInquiryRow).join('')||'<div class="today-inquiry-filter-empty">현재 선택한 조건의 견적문의가 없습니다.</div>')+'</div></div></section>';
 };

 root.inqCtlConsole=function(Q,c){
  var admin=root.inqCtlRoleView()==='admin';
  c=c||root.inqCtlCounts(root.inqCtlScopeActive(),root.inqCtlScopeTrash(),root.inqTechReviewRows());
  var summary=(admin?[['신규','이번 주 접수','신규 문의'],['미배정','원인 확인·즉시 배정','risk'],['배정완료','최초응대 대기','warn'],['영업전환','파이프라인 연결','ok'],['휴지통','30일 보관','risk']]:[['내 할 일','응대·다음 행동 필요','risk'],['배정완료','최초응대 시작','warn'],['응대중','다음 행동 관리',''],['영업전환','Pipeline 연결','ok'],['보류','재개 전 대기','']]).map(function(x){return '<button class="'+(x[2]||'')+'" onclick="inqCtlSetTab(\''+x[0]+'\')"><span>'+x[0]+'</span><b>'+c[x[0]]+'건</b><small>'+x[1]+'</small></button>'}).join('');
  var list=Q.slice().sort(function(a,b){
   var ar=admin?(root.inqCtlBucket(a)==='미배정'?0:root.inqCtlBucket(a)==='배정완료'?1:2):(root.inqCtlNeedsAction(a)?0:2)+(root.inquiryResponseLate(a)?-1:0),br=admin?(root.inqCtlBucket(b)==='미배정'?0:root.inqCtlBucket(b)==='배정완료'?1:2):(root.inqCtlNeedsAction(b)?0:2)+(root.inquiryResponseLate(b)?-1:0);
   return ar-br||(admin&&ar===0?root.inquiryAssignmentSort(a,b):String(root.inquiryDate(b)).localeCompare(String(root.inquiryDate(a))));
  });
  var pageSize=50,pages=Math.max(1,Math.ceil(list.length/pageSize)),page=Math.max(1,Math.min(Number(root.G.inqPage)||1,pages));root.G.inqPage=page;root.INQ_CONSOLE_CACHE=list.slice((page-1)*pageSize,page*pageSize);
  var rows=root.INQ_CONSOLE_CACHE.map(function(q){
   var key=root.inqKey(q),owner=root.inquiryRoutedOwner(q),sales=root.inquirySalesOwner(q),consultant=root.inquiryConsultant(q),assigned=!!owner,at=root.inqCtlAssignedAt(q),responseAt=root.inqCtlFirstResponseAt(q),assignedElapsed=at?root.inqCtlElapsed(at):'',late=root.inquiryResponseLate(q),next=root.actionObj(q,root.itemPatch(q,'inq')),work=root.inqCtlWorkLabel(q),siteMeta=[root.inqCtlContactLabel(q),q.brand||'사업유형 미지정'].filter(Boolean).join(' · '),profile=owner?root.repProfile(owner):null,focus=root.inqCtlNeedsAction(q),meta=!assigned?root.inquiryUnassignedMeta(q):null;
   var lead=admin?'<span onclick="event.stopPropagation()"><input type="checkbox" data-k="'+root.escAttr(key)+'" '+(root.INQ_SEL[key]?'checked':'')+' onclick="inqTick(this.dataset.k,this.checked)"></span>':'<span><i class="inq-focus-mark '+(late?'hot':focus?'hot':'ready')+'">'+(late?'!':focus?'•':'✓')+'</i></span>';
   var response='<span class="inq-ctl-response '+(late?'late':'')+'"><strong>'+(responseAt?'최초응대 완료':assigned?'최초응대 없음':'응대 전')+'</strong><small>'+(responseAt?root.esc(root.inqCtlResponseLabel(responseAt)):(late?'배정 후 '+root.INQUIRY_RESPONSE_SLA_HOURS+'시간 초과':root.esc(meta?meta.elapsed.label+' 경과':'미배정')))+'</small></span>';
   var state='<span>'+root.inqCtlStatusBadge(q)+(next&&next.text?'<small style="display:block;margin-top:3px;color:var(--sub);font-size:11.5px">'+root.esc(next.text)+'</small>':'')+'</span>';
   var actions='<span class="inq-ctl-row-actions" onclick="event.stopPropagation()">'+(!assigned&&admin?'<button class="inq-ctl-assign-now" data-k="'+root.escAttr(key)+'" onclick="inqCtlOpenAssign(\'assign\',this.dataset.k)">배정</button>':'')+'<button class="inq-ctl-more" data-k="'+root.escAttr(key)+'" onclick="inqCtlOpenMenu(this.dataset.k)" aria-label="문의 처리 메뉴">⋯</button></span>';
   if(!admin)return '<div class="inq-ctl-row mine-row '+(late?'attn':'')+'" onclick="inqCtlOpenSingle(this.dataset.k)" data-k="'+root.escAttr(key)+'">'+lead+'<span class="dim">'+root.esc(String(root.inquiryDate(q)||'').slice(5,10).replace('-','/')||'—')+'</span><span class="inq-ctl-site"><strong>'+root.esc(q.site||'현장명 미입력')+'</strong><small>'+root.esc(siteMeta)+'</small></span><span class="dim">'+root.esc(work)+'</span>'+response+state+actions+'</div>';
   var ownerCell=sales?'<strong>'+root.esc(root.repDisplay(owner))+'</strong><small>'+(at?'배정 '+root.esc(assignedElapsed):'배정시각 미기록')+'</small>':owner?'<strong>'+root.esc(root.repDisplay(owner))+'</strong><small>'+(profile&&profile.role==='branch_pool'?'지사 실담당 지정 필요':'기존 배정 · 변경 시 현행 영업담당 선택')+'</small>':'<strong>미배정 · '+root.esc(meta.elapsed.label)+'</strong><small class="inq-unassigned-reason">'+root.esc(meta.label)+'</small><small class="inq-assignment-attempt">'+root.esc(meta.attemptLabel)+'</small>';
   return '<div class="inq-ctl-row '+(late||!assigned?'attn':'')+'" onclick="inqCtlOpenSingle(this.dataset.k)" data-k="'+root.escAttr(key)+'">'+lead+'<span class="dim">'+root.esc(String(root.inquiryDate(q)||'').slice(5,10).replace('-','/')||'—')+'</span><span class="inq-ctl-site"><strong>'+root.esc(q.site||'현장명 미입력')+'</strong><small>'+root.esc(siteMeta)+'</small></span><span class="dim">'+root.esc(work)+'</span><span class="inq-ctl-consultant"><strong>'+root.esc(consultant||'—')+(consultant?'<i class="employee-badge">상담</i>':'')+'</strong><small>'+(consultant?(responseAt?'상담 기록 있음':'상담 진행/기록 대기'):'상담담당 없음')+'</small></span><span class="inq-ctl-assignee '+(!assigned?'missing':'')+'">'+ownerCell+'</span>'+response+state+actions+'</div>';
  }).join('');
  var selected=Object.keys(root.INQ_SEL).length,allChecked=root.INQ_CONSOLE_CACHE.length&&root.INQ_CONSOLE_CACHE.every(function(q){return root.INQ_SEL[root.inqKey(q)]}),pager=pages>1?'<div class="inq-ctl-pager"><button '+(page===1?'disabled':'')+' onclick="inqCtlPage('+(page-1)+')">← 이전</button><span>'+page+' / '+pages+' · '+list.length+'건</span><button '+(page===pages?'disabled':'')+' onclick="inqCtlPage('+(page+1)+')">다음 →</button></div>':'',headerLead=admin?'<span><input type="checkbox" '+(allChecked?'checked':'')+' onclick="inqCtlTickAll(this.checked)"></span>':'<span>우선</span>';
  var header=admin?headerLead+'<span>접수</span><span>현장·연락처·사업유형</span><span>공종</span><span>상담담당</span><span>영업담당·미배정 사유</span><span>최초응대</span><span>상태·Next</span><span>바로 조치</span>':headerLead+'<span>접수</span><span>현장·연락처·사업유형</span><span>공종</span><span>최초응대</span><span>상태·Next</span><span>처리</span>';
  var bulk=admin?'<div class="inq-ctl-bulk"><strong><span id="inqSelN">'+selected+'</span>건 선택됨</strong><button class="primary" onclick="inqCtlOpenAssign(\'assign\')">영업담당 배정</button><button onclick="inqCtlOpenAssign(\'reassign\')">영업담당 재배정</button><button onclick="inqCtlOpenReason(\'unassign\')">미배정 회수</button><button onclick="inqCtlOpenReason(\'hold\')">보류</button><button class="danger" onclick="inqCtlOpenTrash()">휴지통</button></div>':'';
  root.$('#sg-panel').innerHTML=root.noticeHtml()+'<div class="inq-ctl-summary">'+summary+'</div><div class="inq-ctl-table"><div class="inq-ctl-scroll"><div class="inq-ctl-row head '+(admin?'':'mine-row')+'">'+header+'</div>'+(rows||'<div class="inq-ctl-empty"><b>해당 조건의 문의가 없습니다.</b>다른 상태 탭이나 필터를 확인해 주세요.</div>')+'</div>'+pager+'</div>'+bulk;
 };
 root.inqConsole=root.inqCtlConsole;
})(window);
