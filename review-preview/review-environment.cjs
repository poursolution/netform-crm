'use strict';
// Repository checkout first; the fallback keeps the existing local candidate usable.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const workspaceBaseline=path.resolve(root,'../mobile-handoff-20261011/netform-crm-ad209245d50bdc46569b9533fdcf3b601936f679');
const baseline=fs.existsSync(path.join(root,'list-pager.js'))?root:workspaceBaseline;
function launchOptions(){const options={headless:true};const configured=process.env.PLAYWRIGHT_EXECUTABLE_PATH;if(configured)options.executablePath=configured;else if(process.platform==='win32'){const edge=path.join(process.env['ProgramFiles(x86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe');if(fs.existsSync(edge))options.executablePath=edge;}return options;}
module.exports={root,baseline,launchOptions,fixture:name=>path.join(__dirname,'fixtures',name)};
