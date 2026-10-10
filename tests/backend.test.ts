import {test,expect,afterEach} from 'bun:test';
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WechatBackend} from '../src/backend';
import {PrivateStore} from '../src/store';
import type {Reader,Tool} from '../src/source';
const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
const chat={id:'test-private',name:'合成私聊',type:'private' as const};
const row=(id:number,text='合成文字')=>({id:{local_id:id},create_time:id+1_700_000_000,is_from_me:false,kind:'text',text,sender:{display_name:'合成发送人'}});
class FakeReader implements Reader {
  identity='account-1';cursor='c1';closed=false;fail=false;calls:Array<{tool:Tool;input:any}>=[];
  messages=[row(1)];events:any[]=[];hasMore=false;
  async call(tool:Tool,input:any,signal?:AbortSignal){signal?.throwIfAborted();this.calls.push({tool,input});if(this.fail)throw Error('读取失败');
    const data=tool==='status'?{status:{live_read_ok:true}}:tool==='timeline'?{messages:this.messages}:tool==='read_events'?{cursor:this.cursor,events:this.events.map(message=>({message})),query:{has_more:this.hasMore}}:{sessions:[]};
    return {identity:this.identity,data};
  }
  async close(){this.closed=true;}
}
async function setup(){
  const dir=await mkdtemp(join(tmpdir(),'wechat-unit-'));dirs.push(dir);
  const reader=new FakeReader();const metadata=new Map();const published:any[]=[];let paused=false,desktop=true;
  const host:any={dataRoot:dir,app:{records:()=>({read:async(key:string)=>metadata.get(key),write:async(key:string,value:any)=>{metadata.set(key,{value});}}),
    publishNodeEvent:async(input:any)=>{published.push(input);return {id:'event',duplicate:false};},
    core:{getNote:async()=>({value:{id:'note',codeVersion:'fixture-v1',desktopId:'desktop',followingPaused:paused}}),desktopRunnable:async()=>desktop},
    synchronizers:{refresh:async()=>{await backend.tick();}}}};
  const backend=new WechatBackend(host,reader,new PrivateStore(join(dir,'data')));await backend.start();
  const user={kind:'user' as const,noteId:'note'};
  await backend.invoke('bind',{},user);await backend.invoke('select',{chats:[chat]},user);await backend.invoke('enable',{enabled:true},user);
  return {dir,reader,backend,host,user,metadata,published,setPaused:(value:boolean)=>{paused=value;},setDesktop:(value:boolean)=>{desktop=value;}};
}
test('cursor and messages commit atomically; overlapping pages deduplicate; restart resumes persisted cursor',async()=>{
  const {dir,reader,backend,host}=await setup();await backend.tick();
  expect(backend.store.value.chats[0]!.messages.map(m=>m.id)).toEqual(['1']);
  reader.events=[row(1),row(2)];reader.cursor='c2';await backend.tick();await backend.tick();
  expect(backend.store.value.chats[0]!.messages.map(m=>m.id)).toEqual(['1','2']);
  const reopened=new WechatBackend(host,reader,new PrivateStore(join(dir,'data')));await reopened.start();await reopened.tick();
  expect(reader.calls.at(-1)?.input.cursor).toBe('c2');
  expect(reader.calls.filter(c=>c.tool==='timeline')).toHaveLength(1);
  expect((await stat(join(dir,'data/connection.json'))).mode&0o777).toBe(0o600);
});
test('failed read does not advance cursor; recovery catches up without duplicates',async()=>{
  const {reader,backend}=await setup();await backend.tick();reader.fail=true;
  await expect(backend.tick()).rejects.toThrow();expect(backend.store.value.chats[0]!.cursor).toBe('c1');
  reader.fail=false;reader.cursor='c2';reader.events=[row(2)];await backend.tick();
  expect(backend.store.value.error).toBeNull();expect(backend.store.value.chats[0]!.messages).toHaveLength(2);
});
test('no-op polling leaves the private snapshot unchanged',async()=>{
  const {dir,backend}=await setup();await backend.tick();const before=(await stat(join(dir,'data/connection.json'))).mtimeMs;
  await backend.tick();expect((await stat(join(dir,'data/connection.json'))).mtimeMs).toBe(before);
});
test('account change stops before reading selected chats; clear selection permits rebinding',async()=>{
  const {reader,backend,user}=await setup();await backend.tick();reader.identity='account-2';const count=reader.calls.length;
  await expect(backend.tick()).rejects.toThrow('账号已变化');expect(reader.calls.slice(count).map(c=>c.tool)).toEqual(['status']);
  await backend.invoke('select',{chats:[]},user);await backend.invoke('select',{chats:[chat]},user);await backend.tick();
  expect(backend.store.value.identity).toBe('account-2');
});
test('synchronizer follows note pause, desktop pause and user enabled setting',async()=>{
  const {backend,user,setPaused,setDesktop}=await setup();const active=backend.synchronizers.messages!.active;
  expect(await active()).toBe(true);setPaused(true);expect(await active()).toBe(false);setPaused(false);setDesktop(false);expect(await active()).toBe(false);
  setDesktop(true);await backend.invoke('enable',{enabled:false},user);expect(await active()).toBe(false);
  await backend.invoke('enable',{enabled:true},user);expect(await active()).toBe(true);
});
test('invalid message shape fails without publishing an empty replacement or advancing cursor',async()=>{
  const {backend,reader}=await setup();await backend.tick();reader.cursor='c2';reader.events=[{text:'missing identity'}];
  await expect(backend.tick()).rejects.toThrow('消息结构变化');expect(backend.store.value.chats[0]!.cursor).toBe('c1');
  expect(backend.store.value.chats[0]!.messages).toHaveLength(1);
});
test('private data stays outside note state and generic record metadata; model tool reads are blocked',async()=>{
  const {backend,metadata,dir,user}=await setup();await backend.tick();
  expect(JSON.stringify([...metadata.values()])).not.toContain('合成');
  expect(await backend.beforeNativeTool({name:'workbench',arguments:{method:'note.query',input:{noteId:'note',name:'messages'}}})).toContain('本机');
  await expect(backend.invoke('select',{chats:[chat]},{...user,kind:'agent'})).rejects.toThrow('界面');
  expect(JSON.parse(await readFile(join(dir,'data/connection.json'),'utf8')).chats).toHaveLength(1);
  await expect(backend.resources.messages!.load({chatId:chat.id},{scope:{noteId:'other'}} as any)).rejects.toThrow('所属');
});
test('bounded catch-up and storage keep latest 200, unload stops source and active synchronization',async()=>{
  const {reader,backend}=await setup();reader.events=Array.from({length:300},(_,i)=>row(i+2));reader.hasMore=true;await backend.tick();
  expect(reader.calls.filter(c=>c.tool==='read_events')).toHaveLength(5);expect(backend.store.value.chats[0]!.messages).toHaveLength(200);
  await backend.beginClose();await backend.close();expect(reader.closed).toBe(true);expect(await backend.synchronizers.messages!.active()).toBe(false);
});
test('parallel refreshes share ingestion; cancellation leaves the last committed cursor usable',async()=>{
  const {backend,reader}=await setup();await backend.tick();const original=reader.call.bind(reader);
  let entered!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;});
  reader.call=async(tool,input,signal)=>{
    if(tool!=='read_events')return original(tool,input,signal);
    entered();await new Promise<void>((_resolve,reject)=>{signal!.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});});
    return original(tool,input,signal);
  };
  const abort=new AbortController();const first=backend.tick(abort.signal);const second=backend.tick(abort.signal);
  expect(first).toBe(second);await ready;abort.abort();await expect(first).rejects.toThrow('cancelled');
  expect(backend.store.value.chats[0]!.cursor).toBe('c1');expect(backend.store.value.error).toBeNull();
  reader.call=original;reader.events=[row(2)];reader.cursor='c2';await backend.tick();expect(backend.store.value.chats[0]!.messages).toHaveLength(2);
});

const future=(id:number)=>({...row(id),create_time:Math.ceil(Date.now()/1000)+1});
const context={scope:{noteId:'note'}} as any;
test('AI defaults off; opt-in opens only selected-chat relation queries and keeps UI discovery private',async()=>{
  const {backend,user,published}=await setup();await backend.tick();
  expect(await backend.resources.routing!.load({},context)).toEqual({enabled:false,since:0});
  await expect(backend.resources.context!.load({id:chat.id},context)).rejects.toThrow('授权');
  expect(published).toHaveLength(0);
  await backend.invoke('autoConfigure',{enabled:true},user);
  expect((await backend.resources.context!.load({id:chat.id},context) as any).messages).toHaveLength(1);
  await expect(backend.resources.context!.load({id:'unselected'},context)).rejects.toThrow('选择');
  expect(await backend.beforeNativeTool({name:'workbench',arguments:{method:'connection.nodeQuery',input:{noteId:'note',name:'context'}}})).toBeUndefined();
  expect(await backend.beforeNativeTool({name:'workbench',arguments:{method:'note.query',input:{noteId:'note',name:'sessions'}}})).toContain('本机');
  expect((await backend.noteContext({id:'note'}))[0]).toContain('用户已授权');
});
test('only new opted-in text messages publish; baseline, old catch-up and duplicate pages do not',async()=>{
  const {backend,user,reader,published,metadata}=await setup();await backend.tick();
  await backend.invoke('autoConfigure',{enabled:true},user);
  reader.events=[row(1),row(2),future(3),{...future(4),kind:'image'}];reader.cursor='c2';await backend.tick();await backend.tick();
  expect(published).toHaveLength(1);expect(published[0]).toMatchObject({noteId:'note',codeVersion:'fixture-v1',name:'items.changed',payload:{itemId:chat.id,messageId:'3'}});
  expect(JSON.stringify(published)).not.toContain('合成文字');expect(JSON.stringify([...metadata.values()])).not.toContain('合成');
  expect(backend.store.value.chats[0]!.pending).toEqual([]);
});
test('failed publication persists with cursor; restart retries the same event before ingesting more',async()=>{
  const {backend,user,reader,host,dir,published}=await setup();await backend.tick();await backend.invoke('autoConfigure',{enabled:true},user);
  const publish=host.app.publishNodeEvent;host.app.publishNodeEvent=async()=>{throw Error('delivery interrupted');};
  reader.events=[future(2)];reader.cursor='c2';await expect(backend.tick()).rejects.toThrow('delivery interrupted');
  expect(backend.store.value.chats[0]!.cursor).toBe('c2');expect(backend.store.value.chats[0]!.pending?.map(m=>m.id)).toEqual(['2']);
  await backend.invoke('autoConfigure',{enabled:true},{...user,kind:'agent'});
  expect(backend.store.value.chats[0]!.pending?.map(m=>m.id)).toEqual(['2']);
  host.app.publishNodeEvent=publish;
  const reopened=new WechatBackend(host,reader,new PrivateStore(join(dir,'data')));await reopened.start();await reopened.tick();await reopened.tick();
  expect(published).toHaveLength(1);expect(published[0].key).toBe(`wechat:${JSON.stringify([chat.id,'2'])}`);
  expect(reopened.store.value.chats[0]!.pending).toEqual([]);
});
test('handling belongs to its source message, survives repeated ingestion and never publishes another event',async()=>{
  const {backend,user,reader,published}=await setup();await backend.tick();await backend.invoke('autoConfigure',{enabled:true},user);
  reader.events=[future(2)];await backend.tick();
  const relation={kind:'action' as const,noteId:'note',skillCause:{chain:['relation']}};
  const input={id:chat.id,messageId:'2',status:'followed',reason:'已保存待办并交办',task:{noteId:'desk',objectId:'task'}};
  await expect(backend.invoke('recordHandling',input,{...user,kind:'agent'})).rejects.toThrow('连线');
  await expect(backend.invoke('recordHandling',{...input,messageId:'other'},relation)).rejects.toThrow('不属于');
  await backend.invoke('recordHandling',input,relation);await backend.tick();
  expect(backend.store.value.chats[0]!.messages.at(-1)?.handling).toMatchObject({status:'followed',reason:input.reason,task:input.task});
  expect(published).toHaveLength(1);
  await backend.invoke('recordHandling',{...input,status:'skipped',reason:'没有新增要求'},relation);
  expect(backend.store.value.chats[0]!.messages.at(-1)?.handling?.task).toBeUndefined();
});
test('pausing AI keeps ingestion, drops pending automation and re-enabling does not replay that history',async()=>{
  const {backend,user,reader,published}=await setup();await backend.tick();await backend.invoke('autoConfigure',{enabled:true},user);
  await backend.invoke('autoConfigure',{enabled:false},user);reader.events=[future(2)];await backend.tick();
  expect(backend.store.value.chats[0]!.messages).toHaveLength(2);expect(published).toHaveLength(0);
  await backend.invoke('autoConfigure',{enabled:true},user);await backend.tick();expect(published).toHaveLength(0);
});
