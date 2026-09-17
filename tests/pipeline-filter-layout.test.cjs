'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../pipeline-toolbar.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
test('복원한 파이프라인 툴바는 기존 탭의 개편본 캐시를 우회한다',()=>assert.match(html,/pipeline-toolbar\.js\?v=20260918-rollback-1/));
function setup(){const context={window:{},CUR_Y:'2026',G:{year:'2026',quarter:0,rep:'전체',brand:'전체',workFilter:'전체'},paint(){},assignableReps(){return []}};vm.runInNewContext(source,context);return context}
test('individual filter removal preserves other selected filters',()=>{const c=setup();Object.assign(c.G,{rep:'황윤선',brand:'기술자문',quarter:3,workFilter:'방수'});c.window.PipelineToolbar.clear('brand');assert.equal(c.G.brand,'전체');assert.equal(c.G.rep,'황윤선');assert.equal(c.G.quarter,3);assert.equal(c.G.workFilter,'방수')});
test('reset includes work and clears cross-screen Stage drill state',()=>{const c=setup();Object.assign(c.G,{year:'2025',quarter:3,rep:'황윤선',brand:'기술자문',workFilter:'방수',quickStageCodes:['sent'],reportStageCodes:['sent']});c.window.PipelineToolbar.reset();for(const [key,value] of Object.entries({year:'2026',quarter:0,rep:'전체',brand:'전체',workFilter:'전체',quickStageCodes:null,reportStageCodes:null}))assert.equal(c.G[key],value)});
test('quarter selection resolves all-year scope and changing year clears quarter',()=>{const c=setup();c.G.year='전체';c.window.PipelineToolbar.set('quarter','3');assert.equal(c.G.year,'2026');assert.equal(c.G.quarter,3);c.window.PipelineToolbar.set('year','2025');assert.equal(c.G.quarter,0);assert.equal(c.G.year,'2025')});

test('pipeline owns its controls and global controls are not moved through the DOM',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
 const paint=html.slice(html.indexOf('function paint(){'));
 assert.doesNotMatch(paint,/PipelineToolbar\.restoreControls\(\)/);
 assert.match(paint,/pipelinePage=G\.page==='pipe'/);
 assert.equal(source.includes('cloneNode('),false);
 assert.doesNotMatch(source,/function borrow\(|marker\.replaceWith|inlineFilters\(/);
 const c=setup(),before=JSON.stringify(c.G);
 c.window.PipelineToolbar.restoreControls();
 c.window.PipelineToolbar.restoreControls();
 assert.equal(JSON.stringify(c.G),before);
});
