import {expect,test} from 'bun:test';
import {capabilityDefinition,describeCapabilities} from '@dsh-workbench/runtime/internal';
import * as operations from '../template/actions';
describeCapabilities(operations);
const execute=(name:keyof typeof operations,input:unknown,raw:unknown)=>capabilityDefinition(operations[name])!.execute!(input,raw);
const message=(id:number,fromMe=false)=>({id:String(id),time:id,sender:'Synthetic',text:'Synthetic',kind:'text',fromMe});
const chat={id:'fixture',name:'Synthetic',type:'private' as const};
function fixture(){
 const records=new Map<string,{id:string;through:number}>(),messages=[message(10)];
 const resources={read:async({name}:any):Promise<any>=>{
  if(name==='extension.worka-wechat.status')return{data:{ready:true,enabled:true,paused:false,selected:1,issue:null}};
  if(name==='extension.worka-wechat.chats')return{data:{chats:[{...chat,count:messages.length,latest:messages.at(-1)}]}};
  if(name==='extension.worka-wechat.messages')return{data:{chat,messages,updatedAt:0}};
  throw Error('Unexpected provider resource: '+name);
 }};
 const raw=(kind:string):any=>({executionKind:kind,note:{id:'fixture'},caller:{kind:'user'},resources,
  data:{get:async(collection:string,id:string)=>records.get(`${collection}/${id}`)??null,put:async(collection:string,id:string,value:{through:number})=>{records.set(`${collection}/${id}`,{...value,id});}},
  invoke:({name,kind,input}:any)=>execute(name,input,raw(kind)),
 });
 return {raw,resources,records,messages,inbox:async()=>execute('inbox',{},raw('query')) as Promise<{chats:Array<{unread:boolean}>}>,markRead:(input:{chatId:string;messageId:string})=>execute('markRead',input,raw('action'))};
}
test('inbox and read action share durable cursors; a new incoming message restores unread',async()=>{
 const f=fixture();
 expect((await f.inbox()).chats[0]?.unread).toBe(true);
 f.messages.push(message(11,true));
 expect((await f.inbox()).chats[0]?.unread).toBe(false);
 expect(f.records.size).toBe(0);
 expect(await f.markRead({chatId:chat.id,messageId:'11'})).toEqual({readThrough:11});
 expect(f.records.get('reads/'+chat.id)?.through).toBe(11);
 expect((await f.inbox()).chats[0]?.unread).toBe(false);
 f.messages.push(message(12));
 expect((await f.inbox()).chats[0]?.unread).toBe(true);
 await f.markRead({chatId:chat.id,messageId:'10'});
 expect(f.records.get('reads/'+chat.id)?.through).toBe(11);
 expect((await f.inbox()).chats[0]?.unread).toBe(true);
});
test('unknown messages cannot clear unread and query errors cannot look like no unread',async()=>{
 const f=fixture();
 await expect(f.markRead({chatId:chat.id,messageId:'999'})).rejects.toThrow('消息不属于');
 expect(f.records.size).toBe(0);
 f.resources.read=async()=>({error:'Synthetic failure'});
 await expect(f.inbox()).rejects.toThrow('Synthetic failure');
});
