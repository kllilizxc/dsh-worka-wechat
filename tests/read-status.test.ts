import {expect,test} from 'bun:test';
import {queries,markRead} from '../template/actions';
import {readKey} from '../template/chat-order';
const message=(id:number,fromMe=false)=>({id:String(id),time:id,sender:'Synthetic',text:'Synthetic',kind:'text',fromMe});
const chat={id:'fixture',name:'Synthetic',type:'private' as const};
function fixture(){
 const records=new Map<string,number>(),messages=[message(10)];
 const ctx={note:{id:'fixture',version:'v1'},requestId:'synthetic',resources:{read:async({name}:any)=>({data:name.endsWith('.inbox')?{enabled:true,paused:false,error:null,nextRunAt:null,chats:[{...chat,count:messages.length,latest:messages.at(-1)}]}:{chat,messages}})},
 db:{read:async(key:string)=>records.get(key),update:async(key:string,fn:any)=>{const next=await fn(records.get(key));records.set(key,next);return next;}}};
 return {ctx:ctx as any,records,messages};
}
test('inbox and read action share durable cursors; a new incoming message restores unread',async()=>{
 const f=fixture();
 expect((await queries.inbox(f.ctx,{})).chats[0]?.unread).toBe(true);
 f.messages.push(message(11,true));
 expect((await queries.inbox(f.ctx,{})).chats[0]?.unread).toBe(false);
 expect(f.records.size).toBe(0);
 expect(await markRead(f.ctx,{chatId:chat.id,messageId:'11'})).toEqual({readThrough:11});
 expect(f.records.get(readKey(chat.id))).toBe(11);
 expect((await queries.inbox(f.ctx,{})).chats[0]?.unread).toBe(false);
 f.messages.push(message(12));
 expect((await queries.inbox(f.ctx,{})).chats[0]?.unread).toBe(true);
 await markRead(f.ctx,{chatId:chat.id,messageId:'10'});
 expect(f.records.get(readKey(chat.id))).toBe(11);
 expect((await queries.inbox(f.ctx,{})).chats[0]?.unread).toBe(true);
});
test('unknown messages cannot clear unread and query errors cannot look like no unread',async()=>{
 const f=fixture();
 await expect(markRead(f.ctx,{chatId:chat.id,messageId:'999'})).rejects.toThrow('消息不属于');
 expect(f.records.size).toBe(0);
 f.ctx.resources.read=async()=>({error:'Synthetic failure'});
 await expect(queries.inbox(f.ctx,{})).rejects.toThrow('Synthetic failure');
});
