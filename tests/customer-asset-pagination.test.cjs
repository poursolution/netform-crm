'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');

function paginationContext(){
 const start=html.indexOf('function sitePageNumbers(');
 const end=html.indexOf('function setSitePage(',start);
 assert.notEqual(start,-1,'sitePageNumbers must exist');
 assert.notEqual(end,-1,'setSitePage must follow pagination helpers');
 const context={};
 vm.runInNewContext('var SITE_PAGE_BUTTONS=8;'+html.slice(start,end),context);
 return context;
}

test('customer assets use a fixed 20-row page instead of the old 200-row cap',()=>{
 assert.match(html,/var SITE_PAGE_SIZE=20,SITE_PAGE_BUTTONS=8;/);
 assert.match(html,/rows=fullRows\.slice\(start,start\+SITE_PAGE_SIZE\)/);
 assert.doesNotMatch(html,/rows\.slice\(0,200\)\.map/);
 assert.match(html,/sitePaginationHTML\(G\.sitePage,totalPages,fullRows\.length,start,rows\.length\)/);
});
test('page number window starts with 1 through 8 and follows the current page',()=>{
 const {sitePageNumbers}=paginationContext();
 assert.deepEqual(Array.from(sitePageNumbers(53,1,8)),[1,2,3,4,5,6,7,8]);
 assert.deepEqual(Array.from(sitePageNumbers(53,27,8)),[23,24,25,26,27,28,29,30]);
 assert.deepEqual(Array.from(sitePageNumbers(53,53,8)),[46,47,48,49,50,51,52,53]);
});

test('pagination exposes direct numbered navigation and accessible current state',()=>{
 const {sitePaginationHTML}=paginationContext();
 const output=sitePaginationHTML(1,53,1060,0,20);
 for(let page=1;page<=8;page++)assert.match(output,new RegExp('>'+page+'<\\/button>'));
 assert.match(output,/aria-current="page"/);
 assert.match(output,/전체 1,060건/);
 assert.match(output,/setSitePage\(53\)/);
});

test('customer asset filters reset or re-clamp pagination safely',()=>{
 assert.match(html,/function setSiteStatus\(k\)\{[^}]+G\.sitePage=1/);
 assert.match(html,/if\(G\.sitePageKey!==pageKey\)\{G\.sitePage=1;G\.sitePageKey=pageKey\}/);
 assert.match(html,/G\.sitePage=Math\.min\(totalPages,Math\.max\(1,Number\(G\.sitePage\)\|\|1\)\)/);
});
