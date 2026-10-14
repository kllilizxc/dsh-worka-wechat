import {z} from '@dsh-workbench/runtime';
import {note,chatSchema,messageSchema,inboxSchema,handlingSchema,relatedTaskSchema,statusSchema} from './model';
export {note} from './model';
export const background=note.background({async start(ctx){await ctx.host.extensions.request('wechat','bind');}});
export const queries={
  status:note.query({visibility:'public',description:'读取微信接入状态：读取开关、暂停、错误、已选数量和 AI 授权/自动处理状态；不含消息。',input:z.object({}),output:statusSchema},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.status',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'微信接入状态尚未就绪');return snapshot.data as z.infer<typeof statusSchema>;
  }),
  chats:note.query({visibility:'public',description:'列出或按名称查找已经选中的微信会话，返回稳定 ID；无需先有新消息或处理记录。',input:z.object({query:z.string().optional()}),output:z.object({items:z.array(chatSchema)})},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.chats',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'已选微信会话尚未就绪');return snapshot.data as {items:z.infer<typeof chatSchema>[]};
  }),
  related:note.query({visibility:'private',description:'在原消息下显示已关联执行台任务的当前结果与建议回复，供所属便笺界面与 Agent 使用。',input:z.object({id:z.string()}),output:z.array(relatedTaskSchema)},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.related',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'关联任务结果尚未就绪');return snapshot.data as z.infer<typeof relatedTaskSchema>[];
  }),
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
  inbox:note.query({visibility:'private',description:'所属便笺读取会话及本机历史摘要；连线用 status/chats 获取接入信息。',input:z.object({}),output:inboxSchema},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.inbox',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'尚未连接微信');return snapshot.data as z.infer<typeof inboxSchema>;
  }),
  messages:note.query({visibility:'private',description:'所属便笺读取已选会话的本机保留消息，含历史；连线使用 context 授权投影。',input:z.object({chatId:z.string()}),output:z.object({chat:chatSchema,messages:z.array(messageSchema)})},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.messages',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'尚未读取');return snapshot.data as {chat:z.infer<typeof chatSchema>;messages:z.infer<typeof messageSchema>[]};
  }),
  sessions:note.query({visibility:'private',description:'所属便笺搜索候选会话元数据以选择资源；已接入会话用 chats 查询。',input:z.object({keyword:z.string(),offset:z.number().int().nonnegative()}),output:z.object({items:z.array(chatSchema),hasMore:z.boolean()})},async(ctx,input)=>{
    const snapshot=await ctx.resources.read({name:'extension.wechat.sessions',input});
    if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'读取会话失败');return snapshot.data as {items:z.infer<typeof chatSchema>[];hasMore:boolean};
  }),
};
export const initialize=note.action({description:'一次完成本机读取检查；保留已有会话，无选择时仅启用文件传输助手。只返回状态和计数，不返回消息或开启AI处理。',receipt:'idempotent',input:z.object({}),output:z.object({ready:z.boolean(),selected:z.number()})},(ctx)=>ctx.host.extensions.request('wechat','initialize') as Promise<{ready:boolean;selected:number}>);
export const setEnabled=note.action({description:'暂停或恢复本便笺自动读取',input:z.object({enabled:z.boolean()}),output:z.object({enabled:z.boolean()})},(ctx,input)=>ctx.host.extensions.request('wechat','enable',input) as Promise<{enabled:boolean}>);
export const selectChats=note.action({description:'选择本便笺跟踪的微信会话',input:z.object({chats:z.array(chatSchema).max(20)}),output:z.object({selected:z.number()})},(ctx,input)=>ctx.host.extensions.request('wechat','select',input) as Promise<{selected:number}>);
export const refresh=note.action({description:'立即检查已选会话的新消息',input:z.object({}),output:z.object({refreshed:z.boolean()})},(ctx,input)=>ctx.host.extensions.request('wechat','refresh',input) as Promise<{refreshed:boolean}>);
export const autoConfigure=note.action({description:'用户授权或暂停已选微信会话的新消息 AI 自动处理。',input:z.object({enabled:z.boolean()}),output:z.object({enabled:z.boolean(),since:z.number()})},(ctx,input)=>ctx.host.extensions.request('wechat','autoConfigure',input) as Promise<{enabled:boolean;since:number}>);
export const recordHandling=note.action({visibility:'public',description:'回写一条微信消息的跟进或略过原因与任务引用；仅本地保存，不发送微信回复。',objectRef:'/itemId',input:z.object({id:z.string(),messageId:z.string(),status:z.enum(['followed','skipped']),reason:z.string().min(1),task:z.object({noteId:z.string(),objectId:z.string()}).optional()}),output:z.object({itemId:z.string(),messageId:z.string(),handling:handlingSchema})},(ctx,input)=>ctx.host.extensions.request('wechat','recordHandling',input) as Promise<{itemId:string;messageId:string;handling:z.infer<typeof handlingSchema>}>);
export const events={
  changed:note.event({visibility:'public',name:'items.changed',description:'已授权已选微信会话出现新文字消息；根据稳定会话与消息 ID 按需读取。',objectRef:'/itemId',objectLabel:'/title',revision:'/revision',payload:z.object({itemId:z.string(),title:z.string(),messageId:z.string(),revision:z.string()})}),
};
