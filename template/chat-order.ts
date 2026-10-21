import type {Message} from './model';

export const readKey=(chatId:string)=>`read/${encodeURIComponent(chatId)}`;
export const latestFirst=<T extends {id:string;latest:Message|null}>(chats:readonly T[]):T[]=>
  [...chats].sort((a,b)=>(b.latest?.time??0)-(a.latest?.time??0)||Number(b.latest?.id??0)-Number(a.latest?.id??0)||a.id.localeCompare(b.id));
export const unreadSince=(messages:readonly Message[],readThrough:number)=>
  messages.at(-1)?.fromMe!==true&&messages.some(message=>!message.fromMe&&Number(message.id)>readThrough);
export const advanceRead=(current:number|undefined,messageId:string)=>Math.max(current??0,Number(messageId));
