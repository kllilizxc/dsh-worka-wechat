import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,mkdir,stat,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {installRuntime} from './install.mjs';

const assets=resolve(process.env.WORKA_WECHAT_TEST_ASSET||'artifacts/runtime');
const release=JSON.parse(await readFile(join(assets,'release.json'),'utf8'));
const archive=join(assets,release.url.split('/').at(-1));

test('fresh installation is relocatable, needs no external Python, and preserves existing keys on retry',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'wechat clean user '));
  try {
    const root=join(dir,'components with spaces','runtime'),configFile=join(dir,'settings/runtime.json'),keyConfig=join(dir,'private/config.json');
    const options={release,archive,root,configFile,keyConfig};
    const result=await installRuntime(options);
    assert.equal(result.ready,true);assert.equal((await stat(configFile)).mode&0o777,0o600);
    await assert.rejects(access(keyConfig));
    const config=JSON.parse(await readFile(configFile,'utf8'));
    const py=spawnSync(config.python,['-I','-B','-c','import mcp,ssl,sys,os; assert os.path.realpath(sys.prefix).startswith(os.path.realpath(sys.argv[1]))',root],{encoding:'utf8',env:{PATH:'/usr/bin:/bin'}});
    assert.equal(py.status,0,py.stderr);
    const cli=spawnSync(config.cli,['--strict-read-only','call-json','status','{"include_debug":false}'],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',WECHAT_CLI_CONFIG:keyConfig,WECHAT_CLI_STATE_DIR:config.metadata_state,WECHAT_CLI_WCDB_LIB:config.wcdb,WECHAT_CLI_STRICT_READ_ONLY:'1'}});
    assert.equal(cli.status,0,cli.stderr);
    const status=JSON.parse(cli.stdout);assert.equal(status.data.status.live_read_ok,false);
    await mkdir(join(dir,'private'));const synthetic='{"synthetic":"must remain unchanged"}\n';await writeFile(keyConfig,synthetic,{mode:0o600});
    await installRuntime(options);assert.equal(await readFile(keyConfig,'utf8'),synthetic);
    assert.equal(await readFile(configFile,'utf8'),JSON.stringify(config,null,2)+'\n');
  } finally {await rm(dir,{recursive:true,force:true})}
});

test('bad archive leaves the existing configuration untouched',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'wechat-integrity-'));
  try {
    const configFile=join(dir,'runtime.json');await writeFile(configFile,'existing configuration',{mode:0o600});
    const root=join(dir,'not-installed');
    await assert.rejects(installRuntime({release:{...release,sha256:'0'.repeat(64)},archive,root,configFile}),/integrity/);
    assert.equal(await readFile(configFile,'utf8'),'existing configuration');await assert.rejects(access(root));
  } finally {await rm(dir,{recursive:true,force:true})}
});

test('isolated profile environment is shared by installer and reader without using global key configuration',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'wechat-profile-'));
  const paths={WORKA_WECHAT_RUNTIME_ROOT:join(dir,'components'),WORKA_WECHAT_RUNTIME_CONFIG:join(dir,'config/runtime.json'),WORKA_WECHAT_KEY_CONFIG:join(dir,'private/keys.json')};
  const before=Object.fromEntries(Object.keys(paths).map(key=>[key,process.env[key]]));
  try {
    Object.assign(process.env,paths);
    const installed=await installRuntime({release,archive});
    assert.equal(installed.configFile,paths.WORKA_WECHAT_RUNTIME_CONFIG);
    const config=JSON.parse(await readFile(installed.configFile,'utf8'));
    assert.equal(config.key_config,paths.WORKA_WECHAT_KEY_CONFIG);
    assert.ok(config.cli.startsWith(paths.WORKA_WECHAT_RUNTIME_ROOT));
    await assert.rejects(access(config.key_config));
  } finally {
    for(const [key,value] of Object.entries(before))if(value===undefined)delete process.env[key];else process.env[key]=value;
    await rm(dir,{recursive:true,force:true});
  }
});
