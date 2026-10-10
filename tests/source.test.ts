import {test,expect} from 'bun:test';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {LocalMcp} from '../src/source';
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
