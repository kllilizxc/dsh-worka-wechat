import {test,expect} from 'bun:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LocalMcp} from '../src/source';
import {providerRuntime} from '../src/subprocess';
import {PassThrough} from 'node:stream';
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

test('bridge account changes remain distinguishable from a local chat read failure',async()=>{
 const {IdentityError}=await import('../src/source');const dir=await mkdtemp(join(tmpdir(),'wechat-identity-')),config=join(dir,'config.json');
 await writeFile(config,JSON.stringify({python:'/test/python',project:'/test/mcp'}));
 let listen:(chunk:Uint8Array)=>void=()=>{},exit!:()=>void;const done=new Promise<any>(resolve=>{exit=()=>resolve({code:0});});
 const runtime:any={subprocess:{spawn:async()=>({stdout:{onData:(fn:any)=>{listen=fn;queueMicrotask(()=>listen(Buffer.from('{"ready":true}\n')));return()=>{};}},stdin:{write:(line:string)=>{const req=JSON.parse(line);listen(Buffer.from(JSON.stringify({id:req.id,ok:false,code:'account_changed'})+'\n'));}},wait:()=>done,kill:async()=>{exit();}})}};
 const client=new LocalMcp(runtime,'/test/bridge.py',config);
 try{await expect(client.call('read_events',{})).rejects.toBeInstanceOf(IdentityError);}finally{await client.close();await rm(dir,{recursive:true,force:true});}
});
