import {expect,test} from 'bun:test';
import {advanceRead,latestFirst,unreadSince} from '../template/chat-order';
const message=(id:number,time:number,fromMe=false)=>({id:String(id),time,fromMe,sender:'Synthetic',text:'Synthetic',kind:'text'});
test('both views order the same stable chats by activity, including messages in the same second',()=>{
 const chats=[{id:'a',latest:message(2,10)},{id:'empty',latest:null},{id:'b',latest:message(3,20)},{id:'c',latest:message(4,20)}];
 expect(latestFirst(chats).map(chat=>chat.id)).toEqual(['c','b','a','empty']);
 expect(chats.map(chat=>chat.id)).toEqual(['a','empty','b','c']);
});
test('latest outgoing message hides unread until another incoming message arrives',()=>{
 const messages=[message(10,10),message(11,11,true)];
 expect(unreadSince(messages,0)).toBe(false);
 expect(unreadSince(messages.slice(0,1),0)).toBe(true);
 expect(unreadSince([],0)).toBe(false);
 expect(unreadSince(messages,10)).toBe(false);
 expect(unreadSince([...messages,message(12,12)],11)).toBe(true);
 expect(unreadSince([message(13,13,true)],12)).toBe(false);
});
test('out of order read receipts cannot move the read cursor backwards',()=>{
 expect(advanceRead(undefined,'10')).toBe(10);
 expect(advanceRead(12,'10')).toBe(12);
 expect(advanceRead(10,'12')).toBe(12);
});
