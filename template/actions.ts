import {z} from '@dsh-workbench/runtime';
import {note,chatSchema,messageSchema,inboxSchema,handlingSchema} from './model';
export {note} from './model';
export const background=note.background({async start(ctx){await ctx.host.extensions.request('wechat','bind');}});
export const queries={
  routing:note.query({visibility:'public',description:'读取已授权微信消息的自动处理开关与起始时间。',input:z.object({}),output:z.object({enabled:z.boolean(),since:z.number()})},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.routing',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'微信自动处理设置尚未就绪');return snapshot.data as {enabled:boolean;since:number};
  }),
  item:note.query({visibility:'public',description:'读取已选微信会话的稳定身份、最新消息和本地处理反馈；需要明确 AI 授权。',input:z.object({id:z.string()}),output:z.object({item:z.object({id:z.string(),title:z.string(),type:z.enum(['private','group']),latest:messageSchema.nullable(),messageIds:z.array(z.string())}),revision:z.string()}),objectRef:'/item/id',revision:'/revision'},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.item',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'找不到已选微信会话');return snapshot.data as any;
  }),
  context:note.query({visibility:'public',description:'按已选会话 ID 读取最近消息及逐条反馈，供已授权连线核对上下文。',input:z.object({id:z.string()}),output:z.object({chat:chatSchema,messages:z.array(messageSchema)})},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.context',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'微信上下文尚未就绪');return snapshot.data as any;
  }),
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
export const autoConfigure=note.action({description:'用户授权或暂停已选微信会话的新消息 AI 自动处理。',input:z.object({enabled:z.boolean()}),output:z.object({enabled:z.boolean(),since:z.number()})},(ctx,input)=>ctx.host.extensions.request('wechat','autoConfigure',input) as Promise<{enabled:boolean;since:number}>);
export const recordHandling=note.action({visibility:'public',description:'回写一条微信消息的跟进或略过原因与任务引用；仅本地保存，不发送微信回复。',objectRef:'/itemId',input:z.object({id:z.string(),messageId:z.string(),status:z.enum(['followed','skipped']),reason:z.string().min(1),task:z.object({noteId:z.string(),objectId:z.string()}).optional()}),output:z.object({itemId:z.string(),messageId:z.string(),handling:handlingSchema})},(ctx,input)=>ctx.host.extensions.request('wechat','recordHandling',input) as Promise<{itemId:string;messageId:string;handling:z.infer<typeof handlingSchema>}>);
export const events={
  changed:note.event({visibility:'public',name:'items.changed',description:'已授权已选微信会话出现新文字消息；根据稳定会话与消息 ID 按需读取。',objectRef:'/itemId',objectLabel:'/title',revision:'/revision',payload:z.object({itemId:z.string(),title:z.string(),messageId:z.string(),revision:z.string()})}),
};
