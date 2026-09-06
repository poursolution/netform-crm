/* Shared automatic greeting. Names stay in Contacts, not in generated salutations. */
(function(root){
 'use strict';
 const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
 function base(site,contact){
  const c=contact||{};
  let place=clean(site),role=clean(Object.prototype.hasOwnProperty.call(c,'messageRole')?c.messageRole:(c.role||c.title||c.managerRole||c.manager_role));
  if(['','-','미입력','미확인','현장','현장명 미입력'].includes(place))place='';
  role=role.replace(/(?:\s*님)+$/u,'').trim();
  if(['','-','미입력','미확인','미지정','담당자','기타'].includes(role))role='관계자';
  return [place,role].filter(Boolean).join(' ');
 }
 function address(site,c){return base(site,c)+'님'}
 function greeting(site,c){return address(site,c)+', 안녕하세요.\n\n'}
 function personalize(body,site,c){
  // Legacy templates use [관리소장명]님. Keep their drafts compatible without 님님.
  return String(body||'').replace(/\[(?:고객호칭|관리소장명)\]\s*님/g,()=>address(site,c))
   .replace(/\[고객호칭\]/g,()=>address(site,c))
   .replace(/\[관리소장명\]/g,()=>base(site,c));
 }
 const api={base,address,greeting,personalize};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.MessageSalutation=api;
})(typeof window==='undefined'?globalThis:window);
