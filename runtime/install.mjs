import {spawnSync} from 'node:child_process';
import {access,mkdir,mkdtemp,readFile,writeFile,rename,rm,chmod,copyFile,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {digest,verifyBundle} from './bundle.mjs';

export async function installRuntime({release,archive,root,configFile,keyConfig}={}) {
  if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('微信读取组件目前支持 macOS arm64');
  const here=dirname(fileURLToPath(import.meta.url));
  release??=JSON.parse(await readFile(join(here,'release.json'),'utf8'));
  if(!/^\d+\.\d+\.\d+$/.test(release.version)||!/^[a-f0-9]{64}$/.test(release.sha256))throw Error('Invalid fixed runtime release');
  root=resolve(root||join(homedir(),'Library/Application Support/Worka/components/wechat',release.version));
  configFile=resolve(configFile||join(homedir(),'.config/worka-wechat/runtime.json'));
  keyConfig=resolve(keyConfig||join(homedir(),'.config/wxcli/config.json'));
  await mkdir(dirname(root),{recursive:true,mode:0o700});
  let receipt;
  try {receipt=await verifyBundle(root);if(receipt.version!==release.version)throw Error('Runtime version mismatch')}
  catch(error) {
    try{await lstat(root);throw Error('Existing runtime is invalid; preserve it for Agent diagnosis')}catch(e){if(e.code!=='ENOENT')throw e}
    const stage=await mkdtemp(join(dirname(root),'.wechat-install-'));
    try {
      const bytes=archive?await readFile(archive):await (async()=>{
        const response=await fetch(release.url);if(!response.ok)throw Error(`Runtime download: HTTP ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
      })();
      if(digest(bytes)!==release.sha256)throw Error('Runtime archive integrity mismatch');
      const tar=join(stage,'runtime.tar.gz');await writeFile(tar,bytes,{mode:0o600});
      const list=spawnSync('/usr/bin/tar',['-tzf',tar],{encoding:'utf8'});
      if(list.status!==0||list.stdout.split('\n').some(p=>p.startsWith('/')||p.split('/').includes('..')))throw Error('Unsafe runtime archive');
      const unpack=join(stage,'unpacked');await mkdir(unpack,{mode:0o700});
      const result=spawnSync('/usr/bin/tar',['-xzf',tar,'--no-same-owner','-C',unpack],{encoding:'utf8'});
      if(result.status!==0)throw Error('Runtime extraction failed');
      receipt=await verifyBundle(unpack);
      if(receipt.version!==release.version)throw Error('Runtime version mismatch');
      await rename(unpack,root);
    } finally {await rm(stage,{recursive:true,force:true})}
  }
  const config={python:join(root,'python/bin/python3'),project:join(root,'mcp'),cli:join(root,'bin/wechat-cli'),wcdb:join(root,'lib/libWCDB.dylib'),metadata_state:join(dirname(root),'metadata'),key_config:keyConfig};
  await access(config.python,constants.X_OK);await access(config.cli,constants.X_OK);
  await mkdir(dirname(configFile),{recursive:true,mode:0o700});
  const text=JSON.stringify(config,null,2)+'\n';
  let previous;try {
    const st=await lstat(configFile);if(!st.isFile()||st.isSymbolicLink())throw Error('Runtime config must be a regular file');
    previous=await readFile(configFile,'utf8');
  }catch(e){if(e.code!=='ENOENT')throw e}
  if(previous!==text) {
    if(previous){await copyFile(configFile,configFile+'.previous');await chmod(configFile+'.previous',0o600)}
    const temp=configFile+'.next';await writeFile(temp,text,{mode:0o600,flag:'wx'});
    try{await rename(temp,configFile)}finally{await rm(temp,{force:true})}
  }
  await chmod(configFile,0o600);
  return {ready:true,version:receipt.version,configFile,keyConfig,bootstrap:{command:join(root,'bin/wxkey'),args:['bootstrap','--config',keyConfig],env:{WXKEY_NO_ELEVATE:'1',WXKEY_PBKDF_EARLY_STOP:'1',WXKEY_BOOTSTRAP_ORIGINAL_WECHAT:'0',WXKEY_KEEP_SHADOW_WECHAT:'0',WXKEY_NO_REOPEN_ORIGINAL_WECHAT:'0'}}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args=process.argv.slice(2),options={};
  const names={'--root':'root','--config':'configFile','--key-config':'keyConfig','--archive':'archive','--release':'releaseFile'};
  for(let i=0;i<args.length;i+=2){if(!names[args[i]]||!args[i+1])throw Error('Usage: node runtime/install.mjs [--root PATH] [--config PATH] [--key-config PATH] [--archive PATH] [--release PATH]');options[names[args[i]]]=args[i+1]}
  if(options.releaseFile)options.release=JSON.parse(await readFile(options.releaseFile,'utf8'));
  console.log(JSON.stringify(await installRuntime(options)));
}
