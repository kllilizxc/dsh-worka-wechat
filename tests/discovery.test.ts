import {test,expect,afterEach} from 'bun:test';
import {mkdtemp,rm,readFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WechatBackend} from '../src/backend';
import {PrivateStore} from '../src/store';
import type {Reader,Tool} from '../src/source';
const base=Date.parse('2026-10-16T10:00:00+08:00');
const raw=(id:number)=>({id:{local_id:id},create_time:base/1000,is_from_me:false,kind:'text',text:'synthetic',sender:'synthetic'});
const opened:Array<{backend:WechatBackend;dir:string}>=[];
afterEach(async()=>{for(const f of opened.splice(0)){await f.backend.close();await rm(f.dir,{recursive:true,force:true});}});
async function fixture(ids=['A','B'],legacy=false){
 const dir=await mkdtemp(join(tmpdir(),'wechat-discovery-'));let now=base;
 const calls:Array<{tool:Tool;input:any}>=[];
 let changed:string[]=[];
 const discovery=(ids:string[]=changed,cursor='session:next',more=false)=>({identity:'account',data:{cursor,events:ids.map(username=>({session:{username}})),query:{mode:'sessions',has_more:more,scan_truncated:false}}});
 let handler:Reader['call']=async(tool,input)=>tool==='status'?{identity:'account',data:{status:{live_read_ok:true}}}:tool==='read_events'&&!input.talker?discovery():{identity:'account',data:tool==='timeline'?{messages:[]}:{cursor:input.cursor??'local_id:0',events:[],query:{has_more:false}}};
 const reader:Reader={close:async()=>{},call:async(tool,input,signal)=>{calls.push({tool,input:structuredClone(input)});if(tool==='read_events'&&!input.talker&&Number(input.limit)>200)throw Error('MCP supports at most 200 events per page');if(input.since_time!==undefined&&!/^\d+$/.test(String(input.since_time)))throw Error('CLI requires Unix seconds or a calendar date');return handler(tool,input,signal);}};
 const host:any={dataRoot:dir,app:{records:()=>({read:async()=>null,write:async()=>{}}),core:{getNote:async()=>({value:{codeVersion:'synthetic',desktopId:'desktop'}}),desktopRunnable:async()=>true},publishNodeEvent:async()=>({id:'synthetic'})}};
 const store=new PrivateStore(join(dir,'data'));const backend=new WechatBackend(host,reader,store,()=>now);await backend.start();
 await store.transaction(value=>{value.noteId='note';value.enabled=true;value.identity='account';value.chats=ids.map(id=>({chat:{id,name:'synthetic',type:'private'},messages:[],cursor:'local_id:0'}));if(!legacy)value.sync={queue:[],since:base-5000};});
 opened.push({backend,dir});
 return {dir,backend,store,reader,host,calls,discovery,now:()=>now,advance:()=>{now+=5000;},changes:(ids:string[])=>{changed=ids;},handle:(fn:Reader['call'])=>{handler=fn;},chatCalls:()=>calls.filter(call=>call.tool==='read_events'&&call.input.talker)};
}
test('legacy selection is checked once; idle batches use one global read and do not rewrite the private snapshot',async()=>{
 const f=await fixture(Array.from({length:13},(_,n)=>`C${n}`),true);await f.backend.tick();
 expect(f.chatCalls()).toHaveLength(13);expect(f.store.value.sync?.queue).toEqual([]);
 const path=join(f.dir,'data/connection.json'),before=await readFile(path,'utf8'),mtime=(await stat(path)).mtimeMs,calls=f.calls.length;
 f.advance();await f.backend.tick();
 expect(f.calls.length-calls).toBe(1);expect(f.calls.at(-1)?.input.talker).toBeUndefined();
 expect(await readFile(path,'utf8')).toBe(before);expect((await stat(path)).mtimeMs).toBe(mtime);
});
test('only changed selected IDs enter the queue; rapid refreshes join the same five second batch window',async()=>{
 const f=await fixture();f.changes(['A','A','UNSELECTED']);await Promise.all([f.backend.tick(),f.backend.tick()]);
 expect(f.chatCalls().map(call=>call.input.talker)).toEqual(['A']);expect(JSON.stringify(f.store.value)).not.toContain('UNSELECTED');
 const calls=f.calls.length;await f.backend.tick();expect(f.calls).toHaveLength(calls);
 expect(f.store.value.sync?.queue).toEqual([]);
});
test('more than five pages drain in one batch and another changed chat gets a turn between pages',async()=>{
 const f=await fixture();let page=0;
 f.handle(async(tool,input)=>!input.talker?f.discovery(['A','B']):{identity:'account',data:input.talker==='A'?{cursor:`local_id:${++page}`,events:[{message:raw(page)}],query:{has_more:page<7}}:{cursor:'local_id:0',events:[],query:{has_more:false}}});
 await f.backend.tick();expect(f.chatCalls().map(call=>call.input.talker)).toEqual(['A','B','A','A','A','A','A','A']);
 expect(f.store.value.chats[0]!.messages).toHaveLength(7);expect(f.store.value.sync?.queue).toEqual([]);expect(f.now()).toBe(base);
});
test('a broken chat does not block another, and restart resumes the remaining durable queue',async()=>{
 const f=await fixture();let failed=true;
 f.handle(async(_tool,input)=>!input.talker?f.discovery(failed?['A','B']:[]):input.talker==='A'&&failed?Promise.reject(Error('synthetic failure')):{identity:'account',data:{cursor:'local_id:1',events:[{message:raw(1)}],query:{has_more:false}}});
 await expect(f.backend.tick()).rejects.toThrow('synthetic failure');
 expect(f.chatCalls().map(call=>call.input.talker)).toEqual(['A','B']);expect(f.store.value.sync?.queue).toEqual(['A']);
 failed=false;f.advance();const restored=new WechatBackend(f.host,f.reader,new PrivateStore(join(f.dir,'data')),f.now);await restored.start();
 try{await restored.tick();expect(restored.store.value.sync?.queue).toEqual([]);expect(f.chatCalls().map(call=>call.input.talker)).toEqual(['A','B','A']);}finally{await restored.close();}
});
test('a partial global scan resumes its saved page and retains IDs discovered before the failure',async()=>{
 const f=await fixture();let failed=false;
 f.handle(async(_tool,input)=>{
  if(input.talker)return {identity:'account',data:{cursor:'local_id:0',events:[],query:{has_more:false}}};
  if(!input.cursor)return f.discovery(['A'],'session:page-two',true);
  if(!failed){failed=true;throw Error('global page unavailable');}
  return f.discovery(['B']);
 });
 await expect(f.backend.tick()).rejects.toThrow('global page unavailable');
 expect(f.store.value.sync?.queue).toEqual(['A']);expect(f.store.value.sync?.scan?.cursor).toBe('session:page-two');expect(f.chatCalls()).toEqual([]);
 f.advance();const restored=new WechatBackend(f.host,f.reader,new PrivateStore(join(f.dir,'data')),f.now);await restored.start();
 try{await restored.tick();expect(f.calls[2]!.input.cursor).toBe('session:page-two');expect(f.chatCalls().map(call=>call.input.talker)).toEqual(['A','B']);expect(restored.store.value.sync?.scan).toBeUndefined();}finally{await restored.close();}
});
test('a second message in the same timestamp second is discovered through the overlap and deduplicated by local_id',async()=>{
 const f=await fixture(['A']);let latest=1;
 f.handle(async(_tool,input)=>!input.talker?Number(input.since_time)*1000<=base?f.discovery(['A']):f.discovery([]):{identity:'account',data:{cursor:`local_id:${latest}`,events:[{message:raw(latest)}],query:{has_more:false}}});
 await f.backend.tick();latest=2;f.advance();await f.backend.tick();
 expect(f.calls.filter(call=>!call.input.talker)[1]!.input.since_time).toBe(String((base-1000)/1000));
 expect(f.store.value.chats[0]!.messages.map(message=>message.id)).toEqual(['1','2']);
 f.advance();await f.backend.tick();expect(f.chatCalls()).toHaveLength(2);
});
test('selection queues a new chat once and removes deselected pending work',async()=>{
 const f=await fixture();await f.backend.tick();
 await f.store.transaction(value=>{value.sync!.queue=['A'];});
 await f.backend.invoke('select',{chats:[{id:'B',name:'synthetic',type:'private'},{id:'C',name:'synthetic',type:'private'}]},{kind:'user',noteId:'note'} as any);
 expect(f.store.value.sync?.queue).toEqual(['C']);f.advance();await f.backend.tick();
 expect(f.calls.filter(call=>call.tool==='timeline').map(call=>call.input.talker)).toEqual(['C']);expect(f.chatCalls().map(call=>call.input.talker)).toEqual(['C']);
});
test('cancellation retains the queued chat and last committed message cursor',async()=>{
 const f=await fixture(['A']);let entered!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;});
 f.handle(async(_tool,input,signal)=>{if(!input.talker)return f.discovery(['A']);entered();await new Promise((_resolve,reject)=>signal!.addEventListener('abort',()=>reject(signal!.reason),{once:true}));throw Error('unreachable');});
 const abort=new AbortController(),first=f.backend.tick(abort.signal);expect(f.backend.tick()).toBe(first);await ready;abort.abort();await expect(first).rejects.toThrow();
 expect(f.store.value.chats[0]!.cursor).toBe('local_id:0');expect(f.store.value.sync?.queue).toEqual(['A']);expect(f.store.value.error).toBeNull();
});
test('account changes stop discovery before any message read or checkpoint advancement',async()=>{
 const f=await fixture();f.handle(async()=>({...f.discovery(['A']),identity:'other'}));
 await expect(f.backend.tick()).rejects.toThrow('账号已变化');expect(f.chatCalls()).toEqual([]);expect(f.store.value.identity).toBe('account');expect(f.store.value.sync?.since).toBe(base-5000);
});
test('truncated global discovery does not advance its checkpoint',async()=>{
 const f=await fixture();f.handle(async()=>({...f.discovery(['A']),data:{...f.discovery(['A']).data,query:{has_more:false,scan_truncated:true}}}));
 await expect(f.backend.tick()).rejects.toThrow('未完整读取');expect(f.store.value.sync?.since).toBe(base-5000);expect(f.chatCalls()).toEqual([]);
});
test('a failed checkpoint write cannot advance the in-memory discovery window',async()=>{
 const f=await fixture(['A']);const transaction=f.store.transaction.bind(f.store);let fail=true;
 f.store.transaction=((fn:any)=>transaction(async value=>{const result=await fn(value);if(fail&&value.sync?.queue.includes('A')){fail=false;throw Error('storage unavailable');}return result;})) as any;
 f.changes(['A']);await expect(f.backend.tick()).rejects.toThrow('storage unavailable');
 f.advance();await f.backend.tick();expect(f.calls.filter(call=>!call.input.talker).map(call=>call.input.since_time)).toEqual([String((base-5000)/1000),String((base-5000)/1000)]);expect(f.chatCalls()).toHaveLength(1);
});

test('activity in unselected chats does not rewrite the private message snapshot',async()=>{
 const f=await fixture(['A']);const path=join(f.dir,'data/connection.json'),before=await readFile(path,'utf8');
 f.changes(['UNSELECTED']);await f.backend.tick();expect(f.chatCalls()).toEqual([]);expect(await readFile(path,'utf8')).toBe(before);
});
