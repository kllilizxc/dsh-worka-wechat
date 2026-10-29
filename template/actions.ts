import { unreadSince, advanceRead } from './chat-order';
import { z,sha256,isNoteController } from '@dsh-workbench/runtime';
import { note, chatSchema, messageSchema, inboxSchema, handlingSchema, relatedTaskSchema, statusSchema } from './model';
export { note } from './model';

type Context = import('@dsh-workbench/runtime').NoteActionContext<typeof import('./model').note>
  | import('@dsh-workbench/runtime').NoteQueryContext<typeof import('./model').note>;
type Chat = z.infer<typeof chatSchema>;
type Message = z.infer<typeof messageSchema>;
type Handling = z.infer<typeof handlingSchema>;

async function readResource<T>(ctx: Context, name: string, input: Record<string, string|number|boolean> = {}): Promise<T> {
  const result = await ctx.resources.read<T>({ name, input });
  if (result.error) throw new Error(result.error);
  if (result.data === undefined || result.data === null) throw new Error(`${name} 没有返回数据`);
  return result.data;
}

async function getStatus(ctx: Context) {
  return readResource<{
    ready: boolean; connected: boolean; joined: boolean; paused: boolean; enabled: boolean;
    selected: number; issue?: { code?: string; message?: string } | null;
  }>(ctx, 'extension.worka-wechat.status');
}

async function getEvents(ctx: Context) {
  return readResource<{ enabled: boolean; since: number }>(ctx, 'extension.worka-wechat.events');
}

async function getChats(ctx: Context) {
  return readResource<{ chats: Array<Chat & { count: number; latest: Message | null }> }>(ctx, 'extension.worka-wechat.chats');
}

async function getMessages(ctx: Context, chatId: string) {
  return readResource<{ chat: Chat; messages: Message[]; updatedAt: number | null }>(ctx, 'extension.worka-wechat.messages', { chatId });
}

async function authorizedMessages(ctx: Context,id:string){ return getMessages(ctx,id); }

async function handled(ctx: import('@dsh-workbench/runtime').NoteQueryContext<typeof note>, id: string, messages: Message[]) {
  return Promise.all(messages.map(async message => {
    const saved = await ctx.db.get('handling',sha256(JSON.stringify([id,message.id])));
    // The old provider stored feedback with its cached message. Keep that history
    // visible after the one-time cache handoff until a new local receipt exists.
    return { ...message, ...((saved ?? message.handling) ? { handling: saved ?? message.handling } : {}) };
  }));
}

export const connection=note.query({
    description: '只读检查此便笺是否已完成微信真实读取验证。', input: z.object({}),
    output: z.object({ initialized: z.boolean(), error: z.string().nullable() }),
  }, async ctx => {
    const status = await getStatus(ctx);
    return { initialized: status.ready, error: status.issue?.message ?? null };
  });

export const status=note.query({
    visibility: 'public', description: '读取本机微信状态、暂停、会话数量及消息自动处理授权；不读取消息。',
    input: z.object({}), output: statusSchema,
  }, async ctx => {
    const [status, events] = await Promise.all([getStatus(ctx), getEvents(ctx)]);
    return {
      enabled: status.enabled, paused: status.paused,
      error: status.issue?.message ?? null, nextRunAt: null,
      selectedCount: status.selected, authorized: events.since > 0,
      automatic: events.enabled, since: events.since,
    };
  });

export const chats=note.query({
    visibility: 'public', description: '列出已选择微信会话的稳定 ID，可按名称筛选。',
    input: z.object({ query: z.string().optional() }), output: z.object({ items: z.array(chatSchema) }),
  }, async (ctx, input) => {
    const query = input.query?.trim().toLocaleLowerCase();
    const { chats } = await getChats(ctx);
    return { items: chats.filter(row => !query || row.name.toLocaleLowerCase().includes(query) || row.id === query).map(({ id, name, type }) => ({ id, name, type })) };
  });

export const related=note.query({
    visibility: 'private', description: '从本便笺的处理回执读取关联任务摘要；跨便笺任务协调由已授权连线负责。',
    input: z.object({ id: z.string() }), output: z.array(relatedTaskSchema),
  }, async (ctx, input) => {
    const { messages } = await getMessages(ctx, input.id);
    const rows = await handled(ctx, input.id, messages);
    return rows.flatMap(message => {
      const handling = message.handling;
      if (handling?.status !== 'followed' || !handling.task) return [];
      return [{
        noteId: handling.task.noteId, delegationId: handling.task.objectId,
        title: handling.taskTitle ?? handling.task.objectId,
        status: handling.taskStatus ?? 'unknown', archived: handling.taskArchived ?? false,
        summary: handling.taskSummary ?? '', replySuggestion: handling.replySuggestion ?? '',
        revision: handling.taskRevision ?? String(handling.recordedAt), messageIds: [message.id],
      }];
    });
  });

export const routing=note.query({
    visibility: 'public', description: '兼容旧版连线的事件状态查询；已选会话始终发布新消息。',
    input: z.object({}), output: z.object({ enabled: z.boolean(), since: z.number() }),
  }, getEvents);

export const item=note.query({
    visibility: 'public', description: '读取指定已选会话的最新消息、本地处理反馈及稳定修订。',
    input: z.object({ id: z.string() }),
    output: z.object({ item: z.object({ id: z.string(), title: z.string(), type: z.enum(['private', 'group']), latest: messageSchema.nullable(), messageIds: z.array(z.string()) }), revision: z.string() }),
    objectRef: '/item/id', revision: '/revision',
  }, async (ctx, input) => {
    const { chat, messages } = await authorizedMessages(ctx, input.id);
    const withFeedback = await handled(ctx, input.id, messages);
    const latest = withFeedback.at(-1) ?? null;
    if (!latest && !(await getChats(ctx)).chats.some(row => row.id === input.id)) throw new Error('该会话未由当前便笺选择。');
    return { item: { id: chat.id, title: chat.name, type: chat.type, latest, messageIds: withFeedback.map(row => row.id) }, revision: latest ? `${latest.time}:${latest.id}` : 'empty' };
  });

export const context=note.query({
    visibility: 'public', description: '读取指定已选微信会话的消息和本地处理反馈，供已授权连线核对上下文。',
    input: z.object({ id: z.string() }), output: z.object({ chat: chatSchema, messages: z.array(messageSchema) }),
  }, async (ctx, input) => {
    const { chat, messages } = await authorizedMessages(ctx, input.id);
    return { chat, messages: await handled(ctx, input.id, messages) };
  });

export const inbox=note.query({
    visibility: 'private', description: '读取本机已缓存会话和未读位置；不会启动微信实时读取。',
    input: z.object({}), output: inboxSchema,
  }, async ctx => {
    const [status, data] = await Promise.all([getStatus(ctx), getChats(ctx)]);
    const chats = await Promise.all(data.chats.map(async row => {
      const { messages } = await getMessages(ctx, row.id);
      const withFeedback = await handled(ctx, row.id, messages);
      const readThrough = (await ctx.db.get('reads',row.id))?.through ?? 0;
      return { ...row, latest: withFeedback.at(-1) ?? null, unread: unreadSince(withFeedback, readThrough) };
    }));
    return { enabled: status.enabled, paused: status.paused, error: status.issue?.message ?? null, nextRunAt: null, chats };
  });

export const messages=note.query({
    visibility: 'private', description: '读取已选会话在本机缓存的消息；实时刷新使用 refresh 动作。',
    input: z.object({ chatId: z.string() }), output: z.object({ chat: chatSchema, messages: z.array(messageSchema) }),
  }, async (ctx, input) => {
    const { chat, messages } = await getMessages(ctx, input.chatId);
    return { chat, messages: await handled(ctx, input.chatId, messages) };
  });

export const sessions=note.query({
    visibility: 'private', description: '分页读取可供本便笺选择的会话元数据。',
    input: z.object({ keyword: z.string(), offset: z.number().int().nonnegative() }),
    output: z.object({ items: z.array(chatSchema), hasMore: z.boolean() }),
  }, async (ctx, input) => readResource(ctx, 'extension.worka-wechat.sessions', { keyword: input.keyword, offset: input.offset }));

export const setEnabled = note.action({
  description: '暂停或恢复本便笺的微信同步；不改变其他便笺的消费者状态。',
  input: z.object({ enabled: z.boolean() }), output: z.object({ enabled: z.boolean() }),
}, (ctx, input) => ctx.host.extensions.request('worka-wechat', 'enable', input) as Promise<{ enabled: boolean }>);

export const selectChats = note.action({
  description: '保存本便笺自己的微信会话选择，最多 20 个；不改动其他消费者。',
  input: z.object({ chats: z.array(chatSchema).max(20) }), output: z.object({ selected: z.number() }),
}, (ctx, input) => ctx.host.extensions.request('worka-wechat', 'select', input) as Promise<{ selected: number }>);

export const refresh = note.action({
  description: '实时刷新本便笺已选择的微信会话；失败时 provider 保留成功游标。',
  input: z.object({}), output: z.object({ refreshed: z.boolean() }),
}, async ctx => {
  const result = await ctx.host.extensions.request('worka-wechat', 'refresh', {}) as { refreshed: boolean };
  return { refreshed: result.refreshed };
});

export const autoConfigure = note.action({
  description: '兼容旧版客户端的事件配置接口；已选会话始终发布新消息。',
  input: z.object({ enabled: z.boolean() }), output: z.object({ enabled: z.boolean(), since: z.number() }),
}, async (ctx, input) => {
  await ctx.host.extensions.request('worka-wechat', 'events', input);
  return readResource(ctx, 'extension.worka-wechat.events');
});

export const recordHandling = note.action({
  visibility: 'public', description: '将连线核实的微信消息处理结果存入本便笺；只保存本地回执，不分发任务或发送微信消息。',
  objectRef: '/itemId',
  input: z.object({
    id: z.string(), messageId: z.string(), status: z.enum(['followed', 'skipped']), reason: z.string().trim().min(1),
    task: z.object({ noteId: z.string(), objectId: z.string() }).optional(),
    taskTitle: z.string().optional(), taskStatus: z.string().optional(), taskArchived: z.boolean().optional(),
    taskSummary: z.string().optional(), taskRevision: z.string().optional(),
    sessionId: z.string().optional(), replySuggestion: z.string().optional(),
  }),
  output: z.object({ itemId: z.string(), messageId: z.string(), handling: handlingSchema }),
}, async (ctx, input) => {
  if(!isNoteController(ctx.caller,ctx.note.id)&&!ctx.caller.skillCause?.chain.length)throw Error('需要所属便笺或已登记联动的操作授权');
  const { messages } = await getMessages(ctx, input.id);
  const message = messages.find(row => row.id === input.messageId);
  if (!message) throw new Error('消息不属于当前已选微信会话，请重新读取来源。');
  if (input.status === 'followed' && !input.task) throw new Error('跟进回执需要连线提供实际任务引用。');
  if (input.status === 'skipped' && input.task) throw new Error('略过回执不能附加任务引用。');
  const handling: Handling = {
    status: input.status, reason: input.reason.trim(), recordedAt: Date.now(),
    ...(input.task ? { task: input.task } : {}),
    ...(input.taskTitle ? { taskTitle: input.taskTitle } : {}),
    ...(input.taskStatus ? { taskStatus: input.taskStatus } : {}),
    ...(input.taskArchived !== undefined ? { taskArchived: input.taskArchived } : {}),
    ...(input.taskSummary ? { taskSummary: input.taskSummary } : {}),
    ...(input.taskRevision ? { taskRevision: input.taskRevision } : {}),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.replySuggestion ? { replySuggestion: input.replySuggestion } : {}),
  };
  await ctx.runMutation(saveHandling,{id:input.id,messageId:input.messageId,handling});
  return { itemId: input.id, messageId: input.messageId, handling };
});


export const saveHandling=note.mutation({visibility:'private',input:z.object({id:z.string(),messageId:z.string(),handling:handlingSchema})},async(ctx,input)=>{
 if(!isNoteController(ctx.caller,ctx.note.id)&&!ctx.caller.skillCause?.chain.length)throw Error('需要所属便笺或已登记联动的操作授权');
 await ctx.db.put('handling',sha256(JSON.stringify([input.id,input.messageId])),input.handling);
});
export const initialize=note.action({description:'准备并验证本机微信真实读取；保留已有会话，无会话选择时接入文件传输助手。',receipt:'idempotent',input:z.object({}),output:z.object({ready:z.boolean(),selected:z.number()})},async ctx=>{
 await ctx.host.extensions.request('worka-wechat','initialize',{});
 const status=await ctx.host.extensions.request('worka-wechat','status',{}) as {ready:boolean;selected:number};
 return {ready:status.ready,selected:status.selected};
});
export const changed=note.event({visibility:'public',name:'items.changed',description:'已选微信会话出现新消息（包括本人消息和媒体类型）；根据稳定会话与消息 ID 按需读取。',objectRef:'/itemId',objectLabel:'/title',revision:'/revision',payload:z.object({itemId:z.string(),chatId:z.string().optional(),title:z.string(),messageId:z.string(),revision:z.string()})});

export const markRead=note.action({visibility:'private',description:'记录本便笺中已查看的消息位置，不改变微信客户端已读状态。',input:z.object({chatId:z.string(),messageId:z.string().regex(/^\d+$/)}),output:z.object({readThrough:z.number()})},async(ctx,input)=>{
  const snapshot=await ctx.resources.read({name:'extension.worka-wechat.messages',input:{chatId:input.chatId}});
  if(snapshot.error||!snapshot.data)throw Error(snapshot.error??'尚未读取消息');
  if(!(snapshot.data as {messages:z.infer<typeof messageSchema>[]}).messages.some(message=>message.id===input.messageId))throw Error('消息不属于当前会话，请重新读取。');
  return ctx.runMutation(advanceReadCursor,input);
});
export const advanceReadCursor=note.mutation({visibility:'private',input:z.object({chatId:z.string(),messageId:z.string().regex(/^\d+$/)}),output:z.object({readThrough:z.number()})},async(ctx,input)=>{
  const current=await ctx.db.get('reads',input.chatId);
  const readThrough=advanceRead(current?.through,input.messageId);
  await ctx.db.put('reads',input.chatId,{through:readThrough});
  return {readThrough};
});


export const loadSnapshot=note.action({visibility:'private',input:z.object({query:z.enum(['connection','status','chats','related','routing','item','context','inbox','messages','sessions']),input:z.json().default({}),refresh:z.boolean().optional()})},async(ctx,input)=>{
 const value=input.input as {id?:string;chatId?:string;keyword?:string;offset?:number};
 const read=async(name:string,parameters:Record<string,string|number>={})=>{
  const request={name:'extension.worka-wechat.'+name,input:parameters};
  const result=await (input.refresh&&name==='sessions'?ctx.resources.revalidate(request):ctx.resources.read(request));
  if(result.error||!result.data)throw Error(result.error??'微信资料尚未就绪');return result.data;
 };
 switch(input.query){
  case 'connection':await read('status');break;
  case 'status':await read('status');await read('events');break;
  case 'routing':await read('events');break;
  case 'chats':await read('chats');break;
  case 'sessions':await read('sessions',{keyword:value.keyword??'',offset:value.offset??0});break;
  case 'inbox':{
   await read('status');const result=await read('chats') as {chats:Chat[]};
   await Promise.all(result.chats.map(chat=>read('messages',{chatId:chat.id})));break;
  }
  case 'messages':await read('messages',{chatId:value.chatId??''});break;
  default:await read('messages',{chatId:value.id??''});await read('chats');if(input.query==='item'||input.query==='context')await read('events');break;
 }
});
