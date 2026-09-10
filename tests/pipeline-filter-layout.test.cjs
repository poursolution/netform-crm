'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');

test('pipeline filters use distinct controls without horizontal chip rails',()=>{
 assert.match(html,/function setGlobalYear\(v\)/);
 assert.match(html,/function setGlobalPeriod\(v\)/);
 assert.match(html,/class="period-year-select"/);
 assert.match(html,/class="period-segment"/);
 assert.match(html,/function filterRepPicker\(v\)/);
 assert.match(html,/class="rep-filter-picker"/);
 assert.match(html,/class="rep-filter-search"/);
 assert.match(html,/class="filter-business-options"/);
 assert.match(html,/FILTER · 01[\s\S]*?조회기간/);
 assert.match(html,/FILTER · 02[\s\S]*?영업담당자/);
 assert.match(html,/FILTER · 03[\s\S]*?사업구분/);
 assert.match(html,/\.periodbar,\.reptabs,#pg-pipe>#p-brands\{[^}]*overflow:visible/);
});

test('pipeline filter summary and reset preserve the existing state model',()=>{
 assert.match(html,/function pipelineTopFilterLabel\(\)/);
 assert.match(html,/class="filter-current"/);
 assert.match(html,/현재 조회/);
 assert.match(html,/function resetPipelineTopFilters\(\)\{G\.year=CUR_Y;G\.quarter=0;G\.rep='전체';G\.brand='전체'/);
 assert.match(html,/onclick="resetPipelineTopFilters\(\)"/);
 assert.match(html,/G\.brand=this\.dataset\.brand;G\.stageCol=null;paint\(\)/);
 assert.match(html,/function chooseRepFilter\(v\)\{G\.rep=v\|\|'전체'/);
});
