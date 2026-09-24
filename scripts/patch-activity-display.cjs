const fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../.work-netform-login-guidance/crm.html');
let source=fs.readFileSync(file,'utf8');
function replace(old,next){if(!source.includes(old))throw Error('Target missing: '+old);source=source.replace(old,next)}
replace("   R.push({id:a.id,at:a.at||a.occurred_at||a.created_at,src:(a.src==='mobile'?'mobile':'crm'),ttl:a.type||'활동',", "   var detail=a.detail&&typeof a.detail==='object'?a.detail:{},note=a.note&&typeof a.note==='object'?a.note:detail;\r\n   function text(value){return typeof value==='string'?value:''}\r\n   R.push({id:a.id,at:a.at||a.occurred_at||a.created_at,src:(a.src==='mobile'?'mobile':'crm'),ttl:a.type||'활동',");
replace("who:a.actor||a.actor_name||a.assignee||'', body:a.note||a.detail||'', result:a.result||'', fields:[]", "who:a.actor||a.actor_name||a.assignee||'', body:text(a.note)||text(note.note)||text(a.detail), result:text(a.result)||text(note.result), fields:[]");
replace("   if(seen[k])return; seen[k]=1; if(x.at||x.body)U.push(x)","   var previous=seen[k];if(previous){['body','result','who'].forEach(function(f){if(!previous[f]&&x[f])previous[f]=x[f]});return} seen[k]=x; if(x.at||x.body)U.push(x)");
replace('기록된 내용 없음','활동 종류와 시각만 표시됩니다. 상세 내용은 확인되지 않았습니다.');
fs.writeFileSync(file,source);
