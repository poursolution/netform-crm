from pathlib import Path
import re
base=Path(__file__).resolve().parents[1]/'.work-netform-login-guidance'
for name in ['verify-contract-sales-browser.cjs','verify-pipeline-stages-browser.cjs','verify-sales-insights-browser.cjs']:
 p=base/'scripts'/name;s=p.read_text(encoding='utf-8-sig')
 s=re.sub(r"await page.locator\('([^']*) \[data-sales-scope=\"owner\"\]'\).selectOption\('([^']+)'\)",lambda m:"await page.locator('"+m[1]+" [data-sf-type=\""+('EXTERNAL' if m[2] in ['고영운','조성용','전용성'] else 'INTERNAL')+"\"]').click();await page.locator('"+m[1]+" [data-sf-owner=\""+m[2]+"\"]').click()",s)
 s=re.sub(r"await page.locator\('[^']*\[data-sales-scope=\"owner\"\]'\).inputValue\(\)","await page.evaluate(()=>SalesScope.state().owner)",s)
 s=s.replace('data-sales-type','data-sf-type')
 s=s.replace("(await page.locator('#si-dash [data-sales-scope=\"owner\"] option').allTextContents()).slice(1).sort()","(await page.locator('#si-dash [data-sf-owner]').evaluateAll(ns=>ns.map(n=>n.dataset.sfOwner))).slice(1).sort()")
 s=s.replace("await page.locator('#si-perf [data-sales-scope=\"owner\"] option').count()","await page.evaluate(()=>SalesScope.candidates().length+1)")
 for key,value in [('assignment','unassigned'),('organization','gyeongnam')]:
  s=s.replace("await page.locator('#si-perf [data-sales-scope=\""+key+"\"]').selectOption('"+value+"')","await page.evaluate(()=>{SalesScope.change('"+key+"','"+value+"');paint()})")
 s=s.replace("await page.locator('#si-control [data-sales-scope=\"organization\"]').inputValue()","await page.evaluate(()=>SalesScope.state().organization)")
 # Keeping external scope when returning to all external people.
 s=s.replace("await page.locator('#si-dash [data-sf-type=\"INTERNAL\"]').click();await page.locator('#si-dash [data-sf-owner=\"전체\"]').click()","await page.locator('#si-dash [data-sf-owner=\"전체\"]').click()")
 p.write_text(s,encoding='utf-8')
p=base/'scripts/verify-inquiry-role-view-browser.cjs';s=p.read_text(encoding='utf-8-sig').replace('.brandbar button','.sales-filterbar [data-sf-brand]').replace('.brandbar [data-b=','.sales-filterbar [data-sf-brand=');p.write_text(s,encoding='utf-8')
