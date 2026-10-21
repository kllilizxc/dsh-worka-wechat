import {spawnSync,execFileSync} from 'node:child_process';
import {cp,mkdir,mkdtemp,readFile,writeFile,rm,readdir,lstat,chmod} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {digest,inventory,verifyBundle} from './bundle.mjs';

if(process.platform!=='darwin'||process.arch!=='arm64') throw Error('Build on macOS arm64');
const here=dirname(fileURLToPath(import.meta.url));
const version='0.2.0';
const out=resolve(process.argv[2]||'artifacts/runtime');
const cache=resolve(process.env.WORKA_WECHAT_BUILD_CACHE||join(out,'downloads'));
const work=await mkdtemp(join(tmpdir(),'worka-wechat-build-'));
const payload=join(work,'payload');
const env={...process.env,GOTOOLCHAIN:'local',PYTHONDONTWRITEBYTECODE:'1'};
function run(command,args,cwd=work,extra={}) {
  const r=spawnSync(command,args,{cwd,env:{...env,...extra},stdio:'inherit'});
  if(r.status!==0)throw Error(`${command} failed (${r.status})`);
}
async function download(name,source) {
  const file=join(cache,name+(source.url.endsWith('.zip')?'.zip':'.tar.gz'));
  let bytes;try{bytes=await readFile(file)}catch{}
  if(!bytes||digest(bytes)!==source.sha256) {
    const response=await fetch(source.url);if(!response.ok)throw Error(`Download ${name}: HTTP ${response.status}`);
    bytes=Buffer.from(await response.arrayBuffer());
    if(digest(bytes)!==source.sha256)throw Error(`Source hash mismatch: ${name}`);
    await writeFile(file,bytes);
  }
  return file;
}
async function extract(file,dest) {
  await mkdir(dest,{recursive:true});
  if(file.endsWith('.zip')) run(join(payload,'python/bin/python3'),['-I','-c',
    'import zipfile,sys,pathlib; z=zipfile.ZipFile(sys.argv[1]); root=pathlib.Path(sys.argv[2]); prefix=z.namelist()[0].split("@")[0]+"@"+z.namelist()[0].split("@")[1].split("/")[0]+"/"; [(root/n.removeprefix(prefix)).parent.mkdir(parents=True,exist_ok=True) or (root/n.removeprefix(prefix)).write_bytes(z.read(n)) for n in z.namelist() if not n.endswith("/")]',file,dest]);
  else run('/usr/bin/tar',['-xzf',file,'--strip-components','1','-C',dest]);
}
try {
  await mkdir(out,{recursive:true});await mkdir(cache,{recursive:true});await mkdir(payload);
  const sources=JSON.parse(await readFile(join(here,'sources.json'),'utf8'));
  const archives={};for(const [name,source] of Object.entries(sources))archives[name]=await download(name,source);
  await extract(archives.python,join(payload,'python'));
  const python=join(payload,'python/bin/python3');
  run(python,['-I','-m','pip','install','--disable-pip-version-check','--no-compile','--require-hashes','--only-binary=:all:','-r',join(here,'requirements.txt')]);
  for(const name of ['cli','wxkey','sqlcipher'])await extract(archives[name],join(work,name));
  for(const name of ['cli','wxkey']) {
    run('/usr/bin/patch',['-p1','-i',join(here,'patches',name==='cli'?'wechat-cli.patch':'wxkey.patch')],join(work,name));
  }
  const go=process.env.WORKA_GO_BINARY||'go';
  for(const name of ['cli','wxkey'])run(go,['mod','verify'],join(work,name));
  run(go,['test','./cmd/wechat-cli','-run','^(TestDefaultStatusDoesNotScanUnselectedDatabases|TestFileHelperResolvesWithoutMetadataCache|TestReadOSStatusHidesAccountIdentifierUnlessDebug)$','-count=1'],join(work,'cli'));
  run(go,['test','./cmd/wxkey','-run','TestAdministrator|TestShellQuote|TestMainSourceHasNoCredential|TestElevatedConfig|TestPBKDF','-count=1'],join(work,'wxkey'));
  run(go,['test','./internal/dbfiles','-run','^TestCollect','-count=1'],join(work,'wxkey'));
  await mkdir(join(payload,'bin'));await mkdir(join(payload,'lib'));await mkdir(join(payload,'licenses'));
  for(const [name,command] of [['cli','wechat-cli'],['wxkey','wxkey']]) {
    run(go,['build','-trimpath','-buildvcs=false','-o',join(payload,'bin',command),'./cmd/'+command],join(work,name));
    await cp(join(work,name,'LICENSE'),join(payload,'licenses',command+'.txt'));
    const modules=execFileSync(go,['list','-m','-f','{{.Path}}\t{{.Dir}}','all'],{cwd:join(work,name),env,encoding:'utf8'});
    for(const row of modules.trim().split('\n')) {
      const [module,dir]=row.split('\t');if(!dir)continue;
      for(const file of ['LICENSE','LICENSE.txt','COPYING']) {
        try{await cp(join(dir,file),join(payload,'licenses',module.replaceAll('/','_')+'-'+file))}catch(e){if(e.code!=='ENOENT')throw e}
      }
    }
  }
  const goroot=execFileSync(go,['env','GOROOT'],{env,encoding:'utf8'}).trim();
  await cp(join(goroot,'LICENSE'),join(payload,'licenses/go.txt'));
  const manifest=join(work,'sqlcipher/Package.swift');
  const text=await readFile(manifest,'utf8');
  if(!text.includes('name: "sqlcipher",\n            targets:'))throw Error('SQLCipher package changed');
  await writeFile(manifest,text.replace('name: "sqlcipher",\n            targets:','name: "sqlcipher",\n            type: .dynamic,\n            targets:'));
  run('/usr/bin/swift',['build','-c','release','--product','sqlcipher','-Xcc',`-ffile-prefix-map=${work}=.`,'-Xcc',`-fdebug-prefix-map=${work}=.`],join(work,'sqlcipher'));
  await cp(join(work,'sqlcipher/.build/release/libsqlcipher.dylib'),join(payload,'lib/libWCDB.dylib'));
  await cp(join(work,'sqlcipher/LICENSE'),join(payload,'licenses/sqlcipher.txt'));
  const mcp=join(work,'mcp');await extract(archives.mcp,mcp);
  await mkdir(join(payload,'mcp'));await cp(join(mcp,'src'),join(payload,'mcp/src'),{recursive:true});
  await cp(join(mcp,'LICENSE'),join(payload,'licenses/mcp.txt'));
  // Keep interpreter links; installed console scripts contain build-specific shebangs.
  for(const name of await readdir(join(payload,'python/bin')))if(!['python','python3','python3.12'].includes(name))await rm(join(payload,'python/bin',name),{recursive:true,force:true});
  async function clean(dir) {
    for(const name of await readdir(dir)) {
      const path=join(dir,name),st=await lstat(path);
      if(name==='__pycache__'||name.endsWith('.pyc'))await rm(path,{recursive:true,force:true});
      else if(st.isDirectory()){await chmod(path,0o755);await clean(path)}
      else if(st.isFile())await chmod(path,st.mode&0o111?0o755:0o644);
    }
  }
  await clean(payload);
  for(const file of ['bin/wechat-cli','bin/wxkey','lib/libWCDB.dylib'])run('/usr/bin/codesign',['--verify','--strict',join(payload,file)]);
  const patches={};for(const file of await readdir(join(here,'patches')))patches[file]=digest(await readFile(join(here,'patches',file)));
  await writeFile(join(payload,'receipt.json'),JSON.stringify({schemaVersion:1,version,platform:'darwin',arch:'arm64',sources,patches,files:await inventory(payload)},null,2)+'\n');
  await verifyBundle(payload);
  const asset=`worka-wechat-runtime-${version}-darwin-arm64.tar.gz`;
  run('/usr/bin/tar',['-czf',join(out,asset),'-C',payload,'.']);
  const sha256=digest(await readFile(join(out,asset)));
  const tag=process.env.GITHUB_REF_TYPE==='tag'?process.env.GITHUB_REF_NAME:`runtime-v${version}`;
  const release={version,platform:'darwin',arch:'arm64',url:`https://github.com/kllilizxc/dsh-worka-wechat/releases/download/${tag}/${asset}`,sha256};
  await writeFile(join(out,'release.json'),JSON.stringify(release,null,2)+'\n');
  console.log(JSON.stringify({built:true,asset,sha256}));
} finally {await rm(work,{recursive:true,force:true})}
