import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve} from 'node:path';
import {StringDecoder} from 'node:string_decoder';
import type {ManagedProcess, RuntimeHost} from '@realiz3r/worka/host';

export type Tool = 'status' | 'sessions' | 'timeline' | 'read_events';
export type ReadResult = {identity:string; data:any};
export interface Reader {call(tool:Tool,input:Record<string,unknown>,signal?:AbortSignal):Promise<ReadResult>; close():Promise<void>}
export const READ_TOOLS = new Set<Tool>(['status','sessions','timeline','read_events']);
export const READ_ERROR = '读取微信失败，请确认这台 Mac 的微信已登录。若升级后仍失败，需要重新验证本机读取组件。';

/** DSH owns the process; the outer OS sandbox also denies networking to MCP and CLI descendants. */
export class LocalMcp implements Reader {
  private child?:ManagedProcess;
  private starting?:Promise<void>;
  private ready?:{resolve():void;reject(error:Error):void};
  private pending=new Map<number,{resolve(value:ReadResult):void;reject(error:Error):void}>();
  private stops:Array<()=>void>=[];
  private sequence=0;
  private buffer='';
  private closed=false;
  constructor(private runtime:Pick<RuntimeHost,'subprocess'>,private bridge:string,private configFile=resolve(homedir(),'.config/worka-wechat/runtime.json')){}
  private fail() {
    this.ready?.reject(new Error(READ_ERROR));this.ready=undefined;
    for(const entry of this.pending.values())entry.reject(new Error(READ_ERROR));
    this.pending.clear();
  }
  private async start() {
    if(this.closed)throw new Error('微信读取已停止');
    if(this.starting)return this.starting;
    this.starting=(async()=>{
      const config=JSON.parse(await readFile(this.configFile,'utf8'));
      const ready=new Promise<void>((resolve,reject)=>{this.ready={resolve,reject};});
      const child=await this.runtime.subprocess.spawn({command:'/usr/bin/sandbox-exec',
        args:['-p','(version 1)(allow default)(deny network*)',config.python,this.bridge,this.configFile],
        env:{PYTHONDONTWRITEBYTECODE:'1'},cwd:config.project});
      if(this.closed){await child.kill('SIGTERM');throw new Error('微信读取已停止');}
      this.child=child;
      const decoder=new StringDecoder('utf8');
      const onData=(chunk:string|Uint8Array)=>{
        this.buffer+=typeof chunk==='string'?chunk:decoder.write(Buffer.from(chunk));
        if(this.buffer.length>16*1024*1024){this.fail();void child.kill('SIGTERM');return;}
        let end:number;
        while((end=this.buffer.indexOf('\n'))>=0){
          const line=this.buffer.slice(0,end);this.buffer=this.buffer.slice(end+1);
          try{
            const row=JSON.parse(line);
            if(row.ready){this.ready?.resolve();this.ready=undefined;continue;}
            const entry=this.pending.get(row.id);if(!entry)continue;
            this.pending.delete(row.id);
            if(row.ok===true&&typeof row.identity==='string')entry.resolve({identity:row.identity,data:row.data});
            else entry.reject(new Error(row.code==='account_changed'?'微信账号已变化，请重新选择会话。':READ_ERROR));
          }catch{this.fail();void child.kill('SIGTERM');}
        }
      };
      if(child.stdout.onData)this.stops.push(child.stdout.onData(onData));
      else {child.stdout.on?.('data',onData);this.stops.push(()=>{child.stdout.off?.('data',onData);});}
      const stopped=()=>{if(this.child===child){this.child=undefined;this.starting=undefined;this.fail();for(const stop of this.stops.splice(0))stop();this.buffer='';}};
      void child.wait().then(stopped,stopped);
      const timeout=setTimeout(()=>{this.fail();void child.kill('SIGTERM');},35_000);
      try{await ready;}finally{clearTimeout(timeout);}
    })().catch(()=>{this.starting=undefined;throw new Error(READ_ERROR);});
    return this.starting;
  }
  async call(tool:Tool,input:Record<string,unknown>,signal?:AbortSignal):Promise<ReadResult> {
    if(!READ_TOOLS.has(tool))throw new Error('微信便笺只支持读取');
    signal?.throwIfAborted();await this.start();signal?.throwIfAborted();
    const id=++this.sequence;
    return new Promise<ReadResult>((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timeout);signal?.removeEventListener('abort',abort);this.pending.delete(id);};
      const abort=()=>{cleanup();reject(new Error('微信读取已取消'));this.fail();void this.child?.kill('SIGTERM');};
      const timeout=setTimeout(()=>{cleanup();reject(new Error(READ_ERROR));this.fail();void this.child?.kill('SIGTERM');},35_000);
      this.pending.set(id,{resolve:value=>{cleanup();resolve(value);},reject:error=>{cleanup();reject(error);}});
      signal?.addEventListener('abort',abort,{once:true});
      Promise.resolve(this.child!.stdin.write(JSON.stringify({id,tool,input})+'\n')).catch(()=>{cleanup();reject(new Error(READ_ERROR));});
    });
  }
  async close(){this.closed=true;this.fail();const child=this.child;if(child){await child.kill('SIGTERM');await child.wait();}for(const stop of this.stops.splice(0))stop();}
}
