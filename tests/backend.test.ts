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
  const reader=new FakeReader();const metadata=new Map();let paused=false,desktop=true;
  const host:any={dataRoot:dir,app:{records:()=>({read:async(key:string)=>metadata.get(key),write:async(key:string,value:any)=>{metadata.set(key,{value});}}),
    core:{getNote:async()=>({value:{id:'note',desktopId:'desktop',followingPaused:paused,codeVersion:'fixture-code'}}),desktopRunnable:async()=>desktop},
    synchronizers:{refresh:async()=>{await backend.tick();}}}};
  const backend=new WechatBackend(host,reader,new PrivateStore(join(dir,'data')));await backend.start();
  const user={kind:'user' as const,noteId:'note'};
  await backend.invoke('bind',{},user);await backend.invoke('select',{chats:[chat]},user);await backend.invoke('enable',{enabled:true},user);
  return {dir,reader,backend,host,user,metadata,setPaused:(value:boolean)=>{paused=value;},setDesktop:(value:boolean)=>{desktop=value;}};
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

test('only incoming text and own filehelper text publish; outgoing private/group text remains locally visible',async()=>{
  const {backend,reader,host,user}=await setup();const events:any[]=[];
  host.app.publishNodeEvent=async(event:any)=>{events.push(event);};
  const group={id:'synthetic-group@chatroom',name:'文件传输助手',type:'group' as const};
  const helper={id:'filehelper',name:'合成改名助手',type:'private' as const};
  await backend.invoke('select',{chats:[{...chat,name:'文件传输助手'},group,helper]},user);
  await backend.tick();await backend.invoke('autoConfigure',{enabled:true},user);
  const now=Math.ceil(Date.now()/1000);
  reader.events=[{...row(2),create_time:now,is_from_me:false},{...row(3),create_time:now,is_from_me:true},{...row(4),create_time:now,kind:'image',is_from_me:true}];
  await backend.tick();await backend.tick();
  expect(events.map(e=>[e.payload.itemId,e.payload.messageId])).toEqual([[chat.id,'2'],[group.id,'2'],['filehelper','2'],['filehelper','3']]);
  expect(backend.store.value.chats.every(c=>c.messages.some(m=>m.id==='3'&&m.fromMe))).toBe(true);
});

test('restart discards legacy pending outgoing text but retains retry identity for eligible messages',async()=>{
  const {backend,reader,host,dir,user}=await setup();await backend.tick();await backend.invoke('autoConfigure',{enabled:true},user);
  const seen:any[]=[];let fail=true;host.app.publishNodeEvent=async(event:any)=>{seen.push(event);if(fail)throw Error('publish failed');};
  await backend.store.transaction(value=>{value.chats[0]!.pending=[{id:'old-own',time:1,sender:'合成本人',text:'不触发',kind:'text',fromMe:true},{id:'old-incoming',time:1,sender:'合成发送人',text:'应重试',kind:'text',fromMe:false}];});
  await expect(backend.tick()).rejects.toThrow('publish failed');
  expect(backend.store.value.chats[0]!.pending?.map(m=>m.id)).toEqual(['old-incoming']);
  fail=false;const reopened=new WechatBackend(host,reader,new PrivateStore(join(dir,'data')));await reopened.start();await reopened.tick();
  expect(seen.map(e=>e.payload.messageId)).toEqual(['old-incoming','old-incoming']);expect(seen[0].key).toBe(seen[1].key);
  expect(reopened.store.value.chats[0]!.pending).toEqual([]);
});

test('record feedback survives reingestion without publishing an additional event',async()=>{
  const {backend,reader,host,user}=await setup();const events:any[]=[];host.app.publishNodeEvent=async(event:any)=>{events.push(event);};
  await backend.tick();await backend.invoke('autoConfigure',{enabled:true},user);
  reader.events=[{...row(2),create_time:Math.ceil(Date.now()/1000)}];await backend.tick();
  const result=await backend.invoke('recordHandling',{id:chat.id,messageId:'2',status:'followed',reason:'合成任务已交办',task:{noteId:'execution',objectId:'synthetic-task'}},user);
  await backend.tick();expect(events).toHaveLength(1);
  if(!('handling' in result))throw Error('Missing handling receipt');
  expect(backend.store.value.chats[0]!.messages.find(m=>m.id==='2')!.handling).toEqual(result.handling);
});

 test('related results use only selected chat task references, deduplicate and read current public results',async()=>{
  const {backend,host,user}=await setup();await backend.tick();
  await backend.store.transaction(value=>{const first=value.chats[0]!.messages[0]!;first.handling={status:'followed',reason:'合成交办',task:{noteId:'desk',objectId:'bound-task'},recordedAt:1};value.chats[0]!.messages.push({...first,id:'2'});});
  const reads:any[]=[];let reply='合成第一轮回答';
  const ctx:any={scope:{noteId:'note'},read:async(request:any)=>{reads.push(request);return {delegationId:'bound-task',title:'合成任务',status:'completed',archived:false,summary:'合成结论',replySuggestion:reply,revision:reply};}};
  const load=backend.resources.related!.load;
  expect(await load({id:chat.id},ctx)).toEqual([{noteId:'desk',messageIds:['1','2'],delegationId:'bound-task',title:'合成任务',status:'completed',archived:false,summary:'合成结论',replySuggestion:reply,revision:reply}]);
  expect(reads).toEqual([{name:'note.query',input:{noteId:'desk',name:'result',input:{delegationId:'bound-task'}}}]);
  reply='合成更新回答';expect((await load({id:chat.id},ctx) as any)[0].replySuggestion).toBe(reply);
  await expect(load({id:'unselected',noteId:'attacker',delegationId:'other'},ctx)).rejects.toThrow('请先选择');
  await expect(load({id:chat.id},{...ctx,scope:{noteId:'other'}})).rejects.toThrow('所属');
  expect(reads).toHaveLength(2);
 });
