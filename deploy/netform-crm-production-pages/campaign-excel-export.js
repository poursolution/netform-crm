(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CampaignExcelExport=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  function cell(value){
    var s=value==null?'':String(value).replace(/\r?\n/g,' ');
    if(/^[=+\-@]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function csv(columns,rows){
    var lines=[columns.map(function(c){return cell(c.label)}).join(',')];
    rows.forEach(function(row){lines.push(columns.map(function(c){return cell(row[c.key])}).join(','))});
    return '\ufeff'+lines.join('\r\n');
  }
  function download(columns,rows,filename,doc){
    var d=doc||document,blob=new Blob([csv(columns,rows)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=d.createElement('a');
    a.href=url;a.download=filename;a.style.display='none';d.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
  }
  return {cell:cell,csv:csv,download:download};
});
