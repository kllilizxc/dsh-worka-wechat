import {mkdir,readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

export type Chat={id:string;name:string;type:'private'|'group'};
export type Handling={status:'followed'|'skipped';reason:string;task?:{noteId:string;objectId:string};recordedAt:number};
export type Message={id:string;time:number;sender:string;text:string;kind:string;fromMe:boolean;handling?:Handling};
export type ChatState={chat:Chat;cursor?:string;messages:Message[];pending?:Message[]};
export type Connection={noteId:string|null;enabled:boolean;identity:string|null;chats:ChatState[];error:string|null;routing?:{enabled:boolean;since:number}};
export const empty=():Connection=>({noteId:null,enabled:false,identity:null,chats:[],error:null});

/** One bounded private snapshot: messages and cursor publish in the same atomic rename. */
export class PrivateStore {
  value=empty();
  private queue=Promise.resolve();
  private listeners=new Set<()=>void>();
  constructor(private directory:string){}
  async open(){await mkdir(this.directory,{recursive:true,mode:0o700});await chmod(this.directory,0o700);
    try{this.value=JSON.parse(await readFile(resolve(this.directory,'connection.json'),'utf8'));}
    catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
  subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
  transaction<T>(fn:(value:Connection)=>Promise<T>|T):Promise<T>{
    const run=this.queue.then(async()=>{
      const next=structuredClone(this.value);const result=await fn(next);
      if(JSON.stringify(next)!==JSON.stringify(this.value)){
        const temp=resolve(this.directory,`.${randomUUID()}.tmp`);
        await writeFile(temp,JSON.stringify(next),{mode:0o600});
        await rename(temp,resolve(this.directory,'connection.json'));this.value=next;
        for(const listener of this.listeners)listener();
      }
      return result;
    });this.queue=run.then(()=>undefined,()=>undefined);return run;
  }
  drain(){return this.queue;}
}

export function normalize(raw:any):Message {
  if(!Number.isInteger(raw?.id?.local_id)||!Number.isFinite(raw?.create_time))throw new Error('微信消息结构变化，已停止推进同步位置。');
  const sender=raw.sender;
  return {id:String(raw.id.local_id),time:raw.create_time,sender:typeof sender==='string'?sender:String(sender?.display_name??sender?.name??''),
    text:typeof raw.text==='string'?raw.text.slice(0,16_000):'',kind:String(raw.kind??'unknown'),fromMe:raw.is_from_me===true};
}
export function merge(old:Message[],incoming:Message[]):Message[]{
  const byId=new Map(old.map(row=>[row.id,row]));for(const row of incoming)byId.set(row.id,{...row,...(byId.get(row.id)?.handling?{handling:byId.get(row.id)!.handling}:{})});
  return [...byId.values()].sort((a,b)=>a.time-b.time||Number(a.id)-Number(b.id)).slice(-200);
}
