import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
const init="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); [void][Reflection.Assembly]::LoadWithPartialName('System.Security'); ";
export function protectConfig(path,config) {
 if(process.platform!=='win32') throw Error('Windows credential protection required');
 const script=init+"$b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); $e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($e));";
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:JSON.stringify(config),encoding:'utf8',windowsHide:true,maxBuffer:65536});
 if(r.status!==0||!r.stdout.trim()) throw Error('Credential protection failed');
 writeFileSync(path+'.tmp',r.stdout.trim(),{mode:0o600});renameSync(path+'.tmp',path);
}
export function unprotectConfig(path) {
 if(process.platform!=='win32') throw Error('Windows credential protection required');
 const script=init+"$b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $d=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Text.Encoding]::UTF8.GetString($d));";
 const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{input:readFileSync(path,'utf8'),encoding:'utf8',windowsHide:true,maxBuffer:65536});
 if(r.status!==0) throw Error('Credential unlock failed');
 return JSON.parse(r.stdout);
}