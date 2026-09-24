from pathlib import Path
base=Path(__file__).resolve().parents[1]/'.work-netform-login-guidance'
def edit(name, fn):
 p=base/name;s=p.read_text(encoding='utf-8-sig');p.write_text(fn(s),encoding='utf-8')
def replace(s,old,new):
 assert old in s,old[:140]
 return s.replace(old,new)
def pipe(s):
 s=replace(s,"return root.SalesScope.matches(owner,d)&&(!f.brand||f.brand==='전체'||d.brand===f.brand)","return (f.unscoped||root.SalesScope.matches(owner,d))&&(f.unscoped||root.SalesFilterState.matchesBrand(d.brand))&&(!f.brand||f.brand==='전체'||d.brand===f.brand)")
 s=replace(s,"const source=rows({})","const source=rows({unscoped:true})")
 s=replace(s,"+'<div class=\"ps-filters\">'+options('브랜드','brand',brands,root.G.brand)+work", "+root.SalesFilters.controls(source.filter(r=>!def||r.group===key).map(r=>({brand:r.item.brand,owner:r.owner,item:r.item})))+'<div class=\"ps-filters\">'+work")
 s=replace(s,"+'</div>'+root.SalesScope.controls()+'<p class=\"ps-note\">","+'</div>'+'<p class=\"ps-note\">")
 return s
edit('pipeline-workspace.js',pipe)
def insights(s):
 s=replace(s,'function rows(){','function rows(unscoped=false){')
 s=replace(s,'root.G.insights.owner=root.SalesScope.state().owner;', 'root.G.insights.brand=root.G.brand;root.G.insights.owner=root.SalesScope.state().owner;')
 s=replace(s,'deals.filter(d=>root.SalesScope.matches(d.owner,d.item))','deals.filter(d=>unscoped||root.SalesScope.matches(d.owner,d.item)&&root.SalesFilterState.matchesBrand(d.brand))')
 s=replace(s,'inquiries.filter(q=>root.SalesScope.matches(q.owner,q.item))','inquiries.filter(q=>unscoped||root.SalesScope.matches(q.owner,q.item)&&root.SalesFilterState.matchesBrand(q.brand))')
 s=replace(s,'const f=state(),r=rows(),all=', 'const f=state(),r=rows(true),all=')
 s=replace(s,"return '<div class=\"si-filters\">'", "return root.SalesFilters.controls(all)+'<div class=\"si-filters\">'")
 s=replace(s,"+select('브랜드','brand',[['전체','전체 브랜드'],...brands.map(x=>[x,x])],f.brand)", '')
 s=replace(s,"+'</div>'+root.SalesScope.controls();", "+'</div>';" )
 return s
edit('sales-insights.js',insights)
def inquiry(s):
 s=replace(s,"function brands(){return Array.isArray(root.G.inqBrands)?root.G.inqBrands:root.G.brand&&root.G.brand!=='전체'?[root.G.brand]:[]}","function brands(){return root.SalesFilterState.state().brands}")
 s=replace(s,"const brand=root.G.brand,query=root.G.q,selected=brands();root.G.brand='전체';root.G.q='';", "const brand=root.G.brand,rep=root.G.rep,query=root.G.q,selected=brands();root.G.brand='전체';root.G.rep='전체';root.G.q='';")
 s=replace(s,'root.G.brand=brand;root.G.q=query','root.G.brand=brand;root.G.rep=rep;root.G.q=query')
 s=replace(s,'return rows.filter(q=>(ignoreBrand||', 'return rows.filter(q=>(ignoreBrand||root.SalesScope.matches(root.inquiryRoutedOwner(q),q))&&(ignoreBrand||')
 start=s.index(' function selectBrand(value)');end=s.index(' function primaryAction',start)
 s=s[:start]+''' function selectBrand(value){root.SalesFilterState.selectBrand(value);root.G.inqPage=1;root.paint()}
 root.inqBrandChips=function(){let base;ignoreBrand=true;try{base=root.inqCtlScopeActive()}finally{ignoreBrand=false}return root.SalesFilters.controls(base.map(q=>({brand:root.inquiryBrandOf(q),owner:root.inquiryRoutedOwner(q),item:q})))};
'''+s[end:]
 s=replace(s,"brand=signals.querySelector('.brandbar')", "brand=signals.querySelector('.sales-filterbar')")
 start=s.index("filters.innerHTML=(admin?");end=s.index("+'<label>상태",start)
 s=s[:start]+"filters.innerHTML="+s[end+1:]
 s=replace(s,"root.G.rep=filters.elements.owner?.value||'전체';",'')
 return s
edit('inquiry-workbench.js',inquiry)
def expansion(s):
 s=replace(s,"const all=expansionRecords(),current=", "const sourceRows=expansionRecords(),all=sourceRows.filter(r=>SalesFilterState.matchesBrand((expansionSourceDeal(r)||{}).brand)&&SalesScope.matches(r.owner,expansionSourceDeal(r))),current=")
 s=replace(s,"G.expansionYear=this.dataset.v;G.expansionOwner=\\'전체\\';", "G.expansionYear=this.dataset.v;")
 s=replace(s,"G.expansionOwner=this.dataset.owner;", "SalesScope.change(\\'owner\\',this.dataset.owner);SalesFilterState.sync();")
 s=replace(s,"root.innerHTML='<section class=\"exp-command\">", "root.innerHTML=SalesFilters.controls(sourceRows.filter(r=>F.yearMatch(r,expansionSourceDeal(r)||{},year,current)).map(r=>({brand:(expansionSourceDeal(r)||{}).brand,owner:r.owner,item:expansionSourceDeal(r)})))+'<section class=\"exp-command\">")
 start=s.index("<label>담당자 <select title=\"선택한 담당자");end=s.index('<label>상태 <select',start)
 s=s[:start]+s[end:]
 return s
edit('expansion-pool.js',expansion)
edit('contract-sales-data.js',lambda s:replace(s,'const selected=items.filter(r=>{','const selected=items.filter(r=>{\n   if(root.SalesFilterState&&!root.SalesFilterState.matchesBrand(r.brand))return false;'))
def html(s):
 s=replace(s,'<script src="./sales-scope.js?v=20260920-nav-2"></script>', '<script src="./sales-scope.js?v=20260920-nav-2"></script><link rel="stylesheet" href="./sales-filters.css?v=20260920-1"><script src="./sales-filters.js?v=20260920-1"></script>')
 import re
 for name in ['inquiry-workbench.js','pipeline-workspace.js','sales-insights.js','expansion-pool.js','contract-sales-data.js']:
  s=re.sub(re.escape(name)+r'\?v=[^"\s]+',name+'?v=20260920-filters-1',s)
 return s
edit('crm.html',html)
