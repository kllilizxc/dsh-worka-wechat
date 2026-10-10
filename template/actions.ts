import {z} from '@dsh-workbench/runtime';
import {note,chatSchema,messageSchema,inboxSchema} from './model';
export {note} from './model';
export const background=note.background({async start(ctx){await ctx.host.extensions.request('wechat','bind');}});
export const queries={
  inbox:note.query({description:'本机界面读取跟踪会话。禁止通过 AI 查询。',input:z.object({}),output:inboxSchema},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.inbox',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'尚未连接微信');return snapshot.data as z.infer<typeof inboxSchema>;
  }),
  messages:note.query({description:'本机界面读取已选会话的文字。禁止通过 AI 查询。',input:z.object({chatId:z.string()}),output:z.object({chat:chatSchema,messages:z.array(messageSchema)})},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.messages',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'尚未读取');return snapshot.data as {chat:z.infer<typeof chatSchema>;messages:z.infer<typeof messageSchema>[]};
  }),
  sessions:note.query({description:'本机界面选择会话。禁止通过 AI 查询。',input:z.object({keyword:z.string(),offset:z.number().int().nonnegative()}),output:z.object({items:z.array(chatSchema),hasMore:z.boolean()})},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.sessions',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'读取会话失败');return snapshot.data as {items:z.infer<typeof chatSchema>[];hasMore:boolean};
  }),
};
export const setEnabled=note.action({description:'用户暂停或恢复自动读取',input:z.object({enabled:z.boolean()}),output:z.object({enabled:z.boolean()})},(ctx,input)=>ctx.host.extensions.request('wechat','enable',input) as Promise<{enabled:boolean}>);
export const selectChats=note.action({description:'用户在本机界面选择跟踪会话',input:z.object({chats:z.array(chatSchema).max(20)}),output:z.object({selected:z.number()})},(ctx,input)=>ctx.host.extensions.request('wechat','select',input) as Promise<{selected:number}>);
export const refresh=note.action({description:'用户立即检查已选会话的新消息',input:z.object({}),output:z.object({refreshed:z.boolean()})},(ctx,input)=>ctx.host.extensions.request('wechat','refresh',input) as Promise<{refreshed:boolean}>);
