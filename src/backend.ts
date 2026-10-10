import {resolve} from 'node:path';
import type {WorkaExtensionHost,Caller,ResourceDefinition,SynchronizerDefinition,Extension} from '@realiz3r/worka/host';
type NativeToolRequest=Parameters<NonNullable<Extension['beforeNativeTool']>>[0];
import {PrivateStore,normalize,merge,type Chat,type ChatState} from './store';
import {READ_ERROR,type Reader} from './source';

export class WechatBackend {
  readonly resources:Record<string,ResourceDefinition>;
  readonly synchronizers:Record<string,SynchronizerDefinition>;
  private stopped=false;
  private sync?:Promise<void>;
  private activity:ReturnType<WorkaExtensionHost['app']['records']>;
  template?:string;
  constructor(private host:WorkaExtensionHost,private reader:Reader,readonly store=new PrivateStore(resolve(host.dataRoot,'providers/wechat'))) {
    this.activity=host.app.records({owner:'wechat',collection:'activity',storagePrefix:'wechat:activity:'});
    const subscribe=(_input:unknown,invalidate:()=>void)=>store.subscribe(invalidate);
    this.resources={
      inbox:{version:'1',subscribe,load:async(_input,ctx)=>{
        this.owner(ctx.scope.noteId);
        const sync=await ctx.read({name:'synchronizer.wechat.messages.status',input:{}}) as any;
        const data=store.value;
        const note=await host.app.core.getNote(data.noteId!);
        const paused=!!note?.value.followingPaused||!!note?.value.archived||!await host.app.core.desktopRunnable(note?.value.desktopId);
        return {enabled:data.enabled,paused,error:data.error??sync.error??null,nextRunAt:sync.nextRunAt,
          chats:data.chats.map(row=>{const latest=row.messages.at(-1);return {...row.chat,count:row.messages.length,latest:latest?{...latest,text:latest.text.slice(0,160)}:null};})};
      }},
      messages:{version:'1',subscribe,load:async(input,ctx)=>{
        this.owner(ctx.scope.noteId);const id=String((input as any).chatId??'');
        const row=store.value.chats.find(item=>item.chat.id===id);
        if(!row)throw Error('请先选择一个正在跟踪的会话。');
        return {chat:row.chat,messages:row.messages};
      }},
      sessions:{version:'1',load:async(input,ctx)=>{
        this.owner(ctx.scope.noteId);
        const keyword=String((input as any).keyword??'').slice(0,100);
        const offset=Math.max(0,Math.trunc(Number((input as any).offset)||0));
        const result=await reader.call('sessions',{limit:50,offset,...(keyword?{keyword}:{})},ctx.signal);
        this.account(result.identity);
        const rows=result.data.sessions;
        if(!Array.isArray(rows))throw Error(READ_ERROR);
        return {items:rows.filter((row:any)=>row.chat_type==='private'||row.chat_type==='group').map((row:any)=>({id:row.username,name:row.display_name||row.username,type:row.chat_type})),hasMore:rows.length===50};
      }},
      routing:{version:'1',subscribe,load:async(_input,ctx)=>{
        this.owner(ctx.scope.noteId);return this.store.value.routing??{enabled:false,since:0};
      }},
      item:{version:'1',subscribe,load:async(input,ctx)=>{
        this.owner(ctx.scope.noteId);this.consent();
        const row=this.chat(String((input as any).id??''));
        const latest=row.messages.at(-1);
        return {item:{id:row.chat.id,title:row.chat.name,type:row.chat.type,latest:latest??null,messageIds:row.messages.map(message=>message.id)},revision:latest?`${latest.time}:${latest.id}`:'empty'};
      }},
      context:{version:'1',subscribe,load:async(input,ctx)=>{
        this.owner(ctx.scope.noteId);this.consent();
        const row=this.chat(String((input as any).id??''));
        return {chat:row.chat,messages:row.messages};
      }},
    };
    this.synchronizers={messages:{version:'1',intervalMs:5_000,jitter:false,
      active:async()=>{
        // Host-owned invalidation only. Private contacts and messages never enter generic records.
        await this.activity.read('settings');
        const data=store.value;if(this.stopped||!data.noteId||!data.enabled||!data.chats.length)return false;
        const note=await host.app.core.getNote(data.noteId);
        return !!note&&!note.value.archived&&!note.value.followingPaused&&await host.app.core.desktopRunnable(note.value.desktopId);
      },run:signal=>this.tick(signal)}};
  }
  private owner(id?:string){if(!id||id!==this.store.value.noteId)throw Error('只能从所属微信便笺读取。');}
  private consent(){if(!this.store.value.routing?.since)throw Error('请先授权微信消息进入 AI 连线。');}
  private chat(id:string){const row=this.store.value.chats.find(item=>item.chat.id===id);if(!row)throw Error('请先选择一个正在跟踪的会话。');return row;}
  private account(identity:string){if(this.store.value.identity&&this.store.value.identity!==identity)throw Error('微信账号已变化，请清除已选会话后重新选择。');}
  private async activityChanged(){const {noteId,enabled,chats}=this.store.value;await this.activity.write('settings',{noteId,enabled,hasChats:chats.length>0});}
  async start(){await this.store.open();await this.activityChanged();}
  private async readChat(row:ChatState,identity:string,signal?:AbortSignal):Promise<ChatState>{
    signal?.throwIfAborted();
    let next=structuredClone(row);
    if(!next.cursor){
      const result=await this.reader.call('timeline',{talker:row.chat.id,limit:50},signal);
      if(result.identity!==identity)throw Error('微信账号已变化，请重新选择会话。');
      if(!Array.isArray(result.data.messages))throw Error(READ_ERROR);
      next.messages=merge(next.messages,result.data.messages.map(normalize));
    }
    const args=next.cursor?{cursor:next.cursor}:{since_local_id:next.messages.length?Math.max(...next.messages.map(message=>Number(message.id))):0};
    // Bounded catch-up. More pages remain for the next tick; the cursor commits with each page's messages.
    for(let page=0;page<5;page++){
      if(this.stopped||!this.store.value.enabled||!this.store.value.chats.some(item=>item.chat.id===row.chat.id))return next;
      const result=await this.reader.call('read_events',{talker:row.chat.id,...(next.cursor?{cursor:next.cursor}:args),limit:100},signal);
      if(result.identity!==identity)throw Error('微信账号已变化，请重新选择会话。');
      const data=result.data;
      if(typeof data.cursor!=='string'||!Array.isArray(data.events))throw Error(READ_ERROR);
      const incoming=data.events.filter((event:any)=>event.message).map((event:any)=>normalize(event.message));
      next={...next,cursor:data.cursor,messages:merge(next.messages,incoming)};
      signal?.throwIfAborted();
      await this.store.transaction(value=>{
        if(value.identity!==identity||!value.enabled) return;
        const index=value.chats.findIndex(item=>item.chat.id===row.chat.id);
        if(index>=0){
          const current=value.chats[index]!;
          const known=new Set(current.messages.map(message=>message.id));
          next.messages=merge(current.messages,next.messages);
          next.pending=value.routing?.enabled?next.messages.filter(message=>!known.has(message.id)&&message.time*1000>=value.routing!.since&&message.kind==='text'):[];
          value.chats[index]=next;
        }
      });
      await this.publishPending(row.chat.id);
      const current=this.store.value.chats.find(item=>item.chat.id===row.chat.id);
      if(!current)return next;
      next=structuredClone(current);
      if(data.query?.has_more!==true)break;
    }
    return next;
  }
  private async publishPending(chatId:string){
    while(!this.stopped&&this.store.value.routing?.enabled){
      const row=this.store.value.chats.find(item=>item.chat.id===chatId);
      const message=row?.pending?.[0];if(!row||!message)return;
      const note=await this.host.app.core.getNote(this.store.value.noteId!);
      if(!note?.value.codeVersion)throw Error('微信便笺尚未激活消息连线能力。');
      await this.host.app.publishNodeEvent({noteId:this.store.value.noteId!,codeVersion:note.value.codeVersion,name:'items.changed',
        payload:{itemId:chatId,title:row.chat.name,messageId:message.id,revision:`${message.time}:${message.id}`},
        key:`wechat:${JSON.stringify([chatId,message.id])}`});
      await this.store.transaction(value=>{const current=value.chats.find(item=>item.chat.id===chatId);if(current)current.pending=current.pending?.filter(item=>item.id!==message.id);});
    }
  }
  tick(signal?:AbortSignal):Promise<void>{
    if(this.sync)return this.sync;
    this.sync=(async()=>{
      try{
        if(this.stopped||!this.store.value.enabled)return;
        for(const row of this.store.value.chats)await this.publishPending(row.chat.id);
        const status=await this.reader.call('status',{},signal);this.account(status.identity);
        if(status.data.status?.live_read_ok!==true)throw Error(READ_ERROR);
        const identity=status.identity;
        await this.store.transaction(value=>{value.identity??=identity;});
        for(const row of this.store.value.chats)await this.readChat(row,identity,signal);
        signal?.throwIfAborted();
        await this.store.transaction(value=>{value.error=null;});
      }catch(error){
        if(!signal?.aborted&&!this.stopped)await this.store.transaction(value=>{value.error=error instanceof Error?error.message:READ_ERROR;});
        throw error;
      }
    })().finally(()=>{this.sync=undefined;});
    return this.sync;
  }
  async invoke(method:string,input:Record<string,unknown>,caller:Caller){
    if(method==='bind'){
      if(!caller.noteId)throw Error('请从微信便笺使用。');
      await this.store.transaction(value=>{
        if(value.noteId&&value.noteId!==caller.noteId)throw Error('本机已有微信便笺，请沿用原便笺。');
        value.noteId=caller.noteId!;
      });await this.activityChanged();return {bound:true};
    }
    this.owner(caller.noteId);
    if(method==='recordHandling'){
      this.consent();
      if(caller.kind!=='user'&&!caller.skillCause?.chain.length)throw Error('处理回写需要用户或已登记连线。');
      const id=String(input.id??''),messageId=String(input.messageId??'');
      if(!['followed','skipped'].includes(String(input.status))||typeof input.reason!=='string'||!input.reason.trim())throw Error('请说明跟进或略过的具体原因。');
      const handling={status:input.status as 'followed'|'skipped',reason:input.reason.trim(),recordedAt:Date.now(),...(input.status==='followed'&&input.task?{task:input.task as {noteId:string;objectId:string}}:{})};
      await this.store.transaction(value=>{const message=value.chats.find(row=>row.chat.id===id)?.messages.find(row=>row.id===messageId);if(!message)throw Error('消息不属于此微信会话，请重新读取来源。');message.handling=handling;});
      return {itemId:id,messageId,handling};
    }
    if(method==='autoConfigure'){
      if(caller.kind==='schedule')throw Error('AI 授权设置需要用户或当前便笺对话。');
      if(typeof input.enabled!=='boolean')throw Error('enabled 需要布尔值');
      await this.store.transaction(value=>{if((value.routing?.enabled??false)===input.enabled)return;value.routing={enabled:input.enabled as boolean,since:input.enabled?Date.now():value.routing?.since??0};for(const row of value.chats)row.pending=[];});
      return this.store.value.routing??{enabled:false,since:0};
    }
    if(caller.kind!=='user'&&caller.kind!=='action')throw Error('微信便笺的操作需要用户在界面中执行。');
    if(method==='refresh'){await this.host.app.synchronizers.refresh('wechat.messages');return {refreshed:true};}
    if(method==='enable'){
      if(typeof input.enabled!=='boolean')throw Error('enabled 需要布尔值');
      await this.store.transaction(value=>{value.enabled=input.enabled as boolean;});
      await this.activityChanged();
      return {enabled:input.enabled};
    }
    if(method==='select'){
      if(!Array.isArray(input.chats)||input.chats.length>20)throw Error('最多跟踪 20 个会话。');
      const chats=input.chats as Chat[];
      for(const row of chats)if(!row||typeof row.id!=='string'||!row.id||row.id.length>512||typeof row.name!=='string'||row.name.length>512||!['private','group'].includes(row.type))throw Error('请选择有效的微信会话。');
      if(new Set(chats.map(row=>row.id)).size!==chats.length)throw Error('会话不能重复。');
      const status=await this.reader.call('status',{});
      await this.store.transaction(value=>{
        if(value.identity&&value.identity!==status.identity&&chats.length)throw Error('微信账号已变化，请先清除已选会话。');
        value.identity=chats.length?status.identity:null;
        value.chats=chats.map(chat=>{const old=value.chats.find(row=>row.chat.id===chat.id);return old?{...old,chat}:{chat,messages:[]};});
        value.error=null;
      });await this.activityChanged();return {selected:chats.length};
    }
    throw Error('未知的微信便笺操作。');
  }
  async beforeNativeTool(request:NativeToolRequest){
    // UI resources and contact discovery stay private; opted-in relation queries are separate.
    if(request.name!=='workbench')return;
    const args=request.arguments as any;
    const method=args?.method??'';const input=args?.input??{};
    if((['note.query','note.query.revalidate','connection.nodeQuery'].includes(method)&&input.noteId===this.store.value.noteId
      &&((!this.store.value.routing?.since&&input.name!=='routing')||['inbox','messages','sessions'].includes(input.name)))
      ||(method!=='code.saveDraft'&&JSON.stringify(input).includes('extension.wechat.')))return '微信数据仅供本机便笺界面查看，请勿通过 AI 工具读取或上传聊天内容。';
  }
  async noteContext(note:{id:string}){return note.id===this.store.value.noteId?[this.store.value.routing?.since
    ?'用户已授权已选微信会话通过已启用连线进入 AI 上下文，按消息意图创建待办、交办执行台并回写本地处理反馈。仅使用公开 item/context/routing 能力；不读取联系人、未选会话、凭据或 providers/wechat 私有文件，不发送微信回复，不上传到代码仓库或其他网站。'
    :'微信便笺仅供本机只读查看。不要通过工具读取微信消息、会话名称、联系人或 providers/wechat 下的私有文件，也不要上传这些资料。']:[];}
  async pause(_noteId:string){/* The host owns note/desktop pause and cancels its synchronizer. Keep user's enabled choice. */}
  async beginClose(){this.stopped=true;await this.reader.close();}
  async close(){this.stopped=true;await this.reader.close();await this.sync?.catch(()=>{});await this.store.drain();}
}
