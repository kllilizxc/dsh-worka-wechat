import {test,expect} from 'bun:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LocalMcp} from '../src/source';
import {providerRuntime} from '../src/subprocess';
import {PassThrough} from 'node:stream';
test('a missing local runtime gives an actionable setup error without starting a process',async()=>{
  let spawned=false;
  const client=new LocalMcp({subprocess:{spawn:async()=>{spawned=true;throw Error('unexpected');}}} as any,'/unused/bridge',join(tmpdir(),crypto.randomUUID(),'runtime.json'));
  await expect(client.call('status',{})).rejects.toThrow('尚未准备本机微信读取组件');
  await expect(client.call('status',{})).rejects.toMatchObject({code:'operation-rejected'});
  expect(spawned).toBe(false);
  await client.close();
});
test('missing native initialization is distinguished without inferring a denied system permission',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'wechat-unconfigured-'));
  const config=join(dir,'runtime.json');await writeFile(config,JSON.stringify({python:'/unused/python',project:dir,key_config:join(dir,'native-authorization.json')}));
  let spawned=false;
  const client=new LocalMcp({subprocess:{spawn:async()=>{spawned=true;throw Error('unexpected');}}} as any,'/unused/bridge',config);
  try {await expect(client.call('status',{})).rejects.toThrow('本机微信读取初始化尚未完成');expect(spawned).toBe(false);}
  finally {await client.close();await rm(dir,{recursive:true,force:true});}
});
test('provider uses one DSH-owned process range without a second host sandbox',async()=>{
  const stdin=new PassThrough(),stdout=new PassThrough();let spec:any,terminated=false,drained=false;
  const runtime=providerRuntime({spawn:(input:any)=>{
    spec=input;return {stdin,stdout,done:Promise.resolve({exitCode:0}),terminate:()=>{terminated=true;},waitForExit:async()=>{drained=true;return true;}} as any;
  }});
  const child=await runtime.subprocess.spawn({command:'/usr/bin/sandbox-exec',args:['-p','(deny network*)','/test/python'],cwd:'/test/mcp',env:{PYTHONDONTWRITEBYTECODE:'1'}});
  await child.stdin.write('request\n');expect(stdin.read().toString()).toBe('request\n');
  expect(spec.argv).toEqual(['/usr/bin/sandbox-exec','-p','(deny network*)','/test/python']);expect(spec.stdio).toEqual({stdin:'pipe',stdout:'pipe',stderr:'pipe'});
  expect((await child.wait()).code).toBe(0);await child.kill('SIGTERM');expect(terminated&&drained).toBe(true);
});
test('only bounded read tools; OS sandbox covers MCP/CLI; split UTF-8 and orderly process cleanup',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'wechat-source-'));const config=join(dir,'config.json');await writeFile(config,JSON.stringify({python:'/test/python',project:'/test/mcp'}));
  let listen:(chunk:Uint8Array)=>void=()=>{};let exit!:()=>void;let spec:any,killed=false;
  const done=new Promise<any>(resolve=>{exit=()=>resolve({code:0});});
  const runtime:any={subprocess:{spawn:async(value:any)=>{spec=value;
    return {stdout:{onData:(fn:any)=>{listen=fn;queueMicrotask(()=>listen(Buffer.from('{"ready":true}\n')));return()=>{};}},
      stdin:{write:(line:string)=>{const req=JSON.parse(line);const bytes=Buffer.from(JSON.stringify({id:req.id,ok:true,identity:'test',data:{text:'合成中文'}})+'\n');const at=bytes.indexOf(Buffer.from('成'))+1;listen(bytes.subarray(0,at));listen(bytes.subarray(at));}},wait:()=>done,kill:async()=>{killed=true;exit();}};
  }}};
  const client=new LocalMcp(runtime,'/test/bridge.py',config);
  try{await expect(client.call('send' as any,{})).rejects.toThrow('只支持读取');expect(spec).toBeUndefined();
    const value=await client.call('status',{});expect(value.data.text).toBe('合成中文');expect(spec.command).toBe('/usr/bin/sandbox-exec');expect(spec.args.join(' ')).toContain('(deny network*)');
    await client.close();expect(killed).toBe(true);await expect(client.call('status',{})).rejects.toThrow('已停止');
  }finally{await rm(dir,{recursive:true,force:true});}
});
