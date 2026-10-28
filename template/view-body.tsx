import {usePublishedQuery} from './published-query';
import {RelatedRecords} from './record-links';
import {useLocation as useLegacyLocation} from '@dsh-workbench/react';
import {useRouteSearch} from './route-search';
import {useMatch,useNavigate,useSearchParams} from 'react-router';
import {noteHref} from '@dsh-workbench/runtime';
import {latestFirst} from './chat-order';
import {useEffect,useLayoutEffect,useRef,useState,Fragment,type ReactNode} from 'react';
import {Button,SearchField,ScrollShadow} from '@heroui/react';
import {useNote,NoteIcon,NoteGuidance} from '@dsh-workbench/react';
import type {Chat,Message} from './model';
import {TaskResult} from './task';
import '@heroui/styles/css';
import './style.css';

const text=(message:Message|null)=>message?(message.text||`[${({image:'图片',voice:'语音',video:'视频',sticker:'表情',file:'文件'} as Record<string,string>)[message.kind]??'非文字消息'}]`):'尚未读取消息';
const clock=(time:number)=>new Date(time*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});

function MessageList({children,target}:{children:ReactNode;target:string|null}){
  const viewport=useRef<HTMLDivElement>(null);
  const content=useRef<HTMLDivElement>(null);
  const following=useRef(!target);
  useLayoutEffect(()=>{following.current=!target;if(target){const node=document.getElementById('message-'+encodeURIComponent(target));node?.scrollIntoView({block:'center'});node?.focus({preventScroll:true});}},[target,children]);
  const keepLatest=()=>{
    const node=viewport.current;
    if(node&&node.clientHeight>0&&following.current)node.scrollTop=node.scrollHeight;
  };
  useLayoutEffect(keepLatest);
  useLayoutEffect(()=>{
    const observer=new ResizeObserver(keepLatest);
    observer.observe(viewport.current!);
    observer.observe(content.current!);
    return ()=>observer.disconnect();
  },[]);
  return <ScrollShadow ref={viewport} className="message-list" onScroll={event=>{
    const node=event.currentTarget;
    if(node.clientHeight>0)following.current=node.scrollHeight-node.clientHeight-node.scrollTop<=2;
  }}><div ref={content} style={{display:'flow-root'}}>{children}</div></ScrollShadow>;
}

function View(){
  const {metadata,mode,host,actions,layout}=useNote<typeof import('./actions')>();
  const {recordId:focus,requestId}=useLegacyLocation();
  const navigate=useNavigate();const [params,setParams]=useSearchParams();const routeSearch=useRouteSearch();
  const managing=!!useMatch('/notes/:noteId/sessions');
  const selected=useMatch('/notes/:noteId/chats/:chatId')?.params.chatId??null;
  const keyword=params.get('q')??'';const offset=Math.max(0,Number(params.get('offset'))||0);const messageId=params.get('message');
  const setPage=(path:string,replace=false)=>{const query=routeSearch.flush();query.delete('message');void navigate({pathname:noteHref(metadata.id,path),search:query.size?'?'+query.toString():''},{replace});};
  const setSelected=(id:string|null,replace=false)=>setPage(id?'/chats/'+encodeURIComponent(id):'/',replace);
  const setManaging=(value:boolean)=>setPage(value?'/sessions':'/');
  const setOffset=(value:number)=>{const next=routeSearch.flush();value?next.set('offset',String(value)):next.delete('offset');setParams(next);};
  const [pending,setPending]=useState<Chat[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{if(!focus||mode!=='expanded')return;if(focus==='sessions')setManaging(true);else setSelected(focus);},[focus,requestId,mode]);
  const connection=usePublishedQuery('connection',{});
  const initialized=connection.data?.initialized===true;
  const inbox=usePublishedQuery('inbox',{},{enabled:initialized});
  const routing=usePublishedQuery('routing',{},{enabled:initialized});
  const data=inbox.data;
  const chats=latestFirst(data?.chats??[]);
  const messages=usePublishedQuery('messages',{chatId:selected??chats[0]?.id??''},{enabled:initialized&&mode==='expanded'&&!managing&&!!(selected??chats[0]?.id)});
  const chat=selected?(chats.find(row=>row.id===selected)??(messages.data?.chat.id===selected?messages.data.chat:undefined)):chats[0];
  const related=usePublishedQuery('related',{id:chat?.id??''},{enabled:initialized&&mode==='expanded'&&!managing&&!!chat});
  const sessions=usePublishedQuery('sessions',{keyword,offset},{enabled:initialized&&mode==='expanded'&&managing});
  useEffect(()=>{
    if(mode==='expanded'&&!managing&&!selected&&layout.width>600&&chats[0])setSelected(chats[0].id,true);
  },[mode,managing,selected,layout.width,chats[0]?.id]);
  useEffect(()=>{if(messageId||!focus||focus==='sessions'||chat?.id!==focus||managing||mode!=='expanded')return;const target=document.querySelector<HTMLElement>('[data-location-chat]');target?.scrollIntoView({block:'start'});target?.focus({preventScroll:true});},[focus,requestId,chat?.id,managing,mode,messageId]);
  const lastMessage=messages.data?.messages.at(-1);
  const readThrough=useRef(new Map<string,string>());
  useEffect(()=>{
    if(mode!=='expanded'||managing||(!selected&&layout.width<=600)||messages.loading||messages.stale||messages.error||!lastMessage||!chat||messages.data?.chat.id!==chat.id)return;
    const id=chat.id,messageId=lastMessage.id;
    const mark=()=>{
      if(document.visibilityState==='hidden'||readThrough.current.get(id)===messageId)return;
      readThrough.current.set(id,messageId);
      void actions.markRead({chatId:id,messageId}).catch(()=>{
        if(readThrough.current.get(id)===messageId)readThrough.current.delete(id);
        // Keep the durable unread indicator until a read receipt succeeds.
      });
    };
    mark();document.addEventListener('visibilitychange',mark);
    return()=>document.removeEventListener('visibilitychange',mark);
  },[mode,managing,selected,layout.width,chat?.id,lastMessage?.id,messages.loading,messages.stale,messages.error,actions]);
  const enabled=data?.enabled===true;
  const status=data?.paused?'已暂停':data?.error?'读取受阻':enabled?'读取中':'已暂停';
  const failure=error||inbox.error?.message||routing.error?.message||data?.error||'';
  const chosen=pending??chats.map(({id,name,type})=>({id,name,type}));
  const run=async(work:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await work();}catch(cause){setError(cause instanceof Error?cause.message:'操作失败，请重试。');}finally{setBusy(false);}};
  const manage=()=>{setPending(null);setManaging(true);};
  const toggle=(row:Chat)=>setPending(current=>{const value=current??chosen;return value.some(item=>item.id===row.id)?value.filter(item=>item.id!==row.id):[...value,row];});
  const save=()=>run(async()=>{await actions.selectChats({chats:chosen});if(chosen.length)await actions.setEnabled({enabled:true});setPending(null);setManaging(false);});
  const identity=<span className="wechat-identity"><NoteIcon icon={metadata.icon} size={20}/><strong>{metadata.name}</strong></span>;

  if(!initialized)return <section className={'wechat wechat-setup '+(mode==='compact'?'compact':'expanded')}>
    <header>{identity}<span className="wechat-status">{connection.loading?'检查连接中':'等待连接'}</span></header>
    <NoteGuidance title={connection.error?'无法检查微信连接':'连接本机微信'}
      description={error||connection.error?.message||'登录这台 Mac 的微信后完成初始化，已有会话和消息会保留。'}
      action={{label:busy?'正在初始化…':'初始化微信',onPress:()=>{if(!busy)void run(async()=>{await actions.initialize({});await connection.refresh();await inbox.refresh();await routing.refresh();});}}}
      secondary={{label:'查看设置指引',onPress:()=>host.openSetup()}}/>
  </section>;

  if(mode==='compact')return <section className="wechat compact">
    <header>{identity}<span className={'wechat-status '+(failure?'error':'')}>{failure?'读取受阻':status}</span></header>
    {!data&&!inbox.error?<p className="compact-empty">正在连接本机微信…</p>:!data&&inbox.error?<NoteGuidance title="微信连接需要处理" description={failure} action={{label:'检查连接',onPress:()=>host.openSetup()}}/>:!chats.length?<div className="compact-empty"><strong>选择会话</strong><p>自动读取所选会话的新消息。</p><Button size="sm" variant="secondary" onPress={()=>setManaging(true)}>选择会话</Button></div>:<>
      <div className="compact-chats">{chats.slice(0,3).map(row=><div key={row.id} className="compact-chat"><strong>{row.unread&&<span className="unread-dot" role="img" aria-label="本便笺未读"/>}{row.name}</strong><span>{text(row.latest)}</span></div>)}</div>
      <footer><span>{chats.length} 个会话 · 只读</span>{failure?<Button size="sm" variant="ghost" onPress={()=>host.openNote(metadata.id)}>查看原因</Button>:<span>展开查看消息</span>}</footer>
    </>}
  </section>;

  return <section className="wechat expanded">
    {selected&&!messages.loading&&!messages.stale&&(messages.error?<p role="alert">目标会话读取失败：{messages.error.message}</p>:!chat&&<p role="alert">目标会话不存在或已不在授权选择范围内。</p>)}
    <header className="wechat-header">{identity}<div className="wechat-toolbar" role="toolbar" aria-label="微信便笺操作">
      <span className={'wechat-status '+(failure?'error':'')}>{status}</span>
      <Button variant="ghost" isDisabled={busy} onPress={()=>run(()=>actions.setEnabled({enabled:!enabled}))}>{enabled?'暂停读取':'恢复读取'}</Button>
      <Button variant="ghost" isDisabled={busy||!enabled||data?.paused||!chats.length} onPress={()=>run(()=>actions.refresh({}))}>刷新</Button>
      <Button variant="ghost" isDisabled={busy||routing.loading||!!routing.error} onPress={()=>run(()=>actions.autoConfigure({enabled:routing.data?.enabled!==true}))}>{routing.data?.enabled?'暂停 AI 处理':'开启 AI 处理'}</Button>
      <Button variant="secondary" isDisabled={busy} onPress={manage}>选择会话</Button>
    </div></header>
    {failure&&<div className="wechat-error" role="alert"><span>{failure}</span><Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>run(async()=>{await actions.refresh({});await inbox.refresh();})}>重试</Button></div>}
    {data?.paused&&<p className="wechat-hint">便笺或桌面已暂停。请通过 Worka 的恢复入口继续，已读消息会保留。</p>}
    {managing?<section className="wechat-manage">
      <div className="manage-heading"><div><h1>选择会话</h1><p>已选 {chosen.length} / 20 · 仅在本机读取</p></div><Button variant="ghost" isDisabled={busy} onPress={()=>{setPending(null);setManaging(false);}}>取消</Button></div>
      <SearchField aria-label="搜索微信会话" value={routeSearch.value} onChange={routeSearch.setValue} fullWidth>
        <SearchField.Group><SearchField.SearchIcon/><SearchField.Input {...routeSearch.inputProps} placeholder="搜索私聊或群聊"/><SearchField.ClearButton aria-label="清空搜索"/></SearchField.Group>
      </SearchField>
      <ScrollShadow className="session-results">
        {chosen.length>0&&<div className="chosen-chats" aria-label="已选会话">{chosen.map(row=><Button key={row.id} variant="secondary" size="sm" isDisabled={busy} onPress={()=>toggle(row)} aria-label={`取消跟踪 ${row.name}`}>{row.name} ×</Button>)}</div>}
        {sessions.loading&&<p role="status">正在读取会话…</p>}
        {sessions.error&&<div role="alert"><p>{sessions.error.message}</p><Button variant="secondary" onPress={()=>void sessions.refresh()}>重新读取</Button></div>}
        {!sessions.loading&&!sessions.error&&!sessions.data?.items.length&&<p>没有找到匹配的私聊或群聊。</p>}
        <div className="session-list">{sessions.data?.items.map(row=>{const checked=chosen.some(item=>item.id===row.id);return <Button key={row.id} className="session-row" variant={checked?'secondary':'ghost'} aria-pressed={checked} isDisabled={busy||(!checked&&chosen.length>=20)} onPress={()=>toggle(row)}><span className="chat-avatar" aria-hidden="true">{row.name.slice(0,1)}</span><span className="chat-name">{row.name}</span><span className="chat-type">{row.type==='group'?'群聊':'私聊'}</span><span aria-hidden="true">{checked?'✓':'＋'}</span></Button>;})}</div>
      </ScrollShadow>
      <footer className="manage-footer"><div><Button variant="ghost" isDisabled={offset===0||sessions.loading} onPress={()=>setOffset(Math.max(0,offset-50))}>上一页</Button><Button variant="ghost" isDisabled={!sessions.data?.hasMore||sessions.loading} onPress={()=>setOffset(offset+50)}>下一页</Button></div><Button variant="primary" isDisabled={busy} onPress={()=>void save()}>{busy?'保存中…':chosen.length?'保存并读取':'清除已选会话'}</Button></footer>
    </section>:!chats.length&&!selected?<div className="wechat-guidance"><NoteGuidance title="选择会话" description="保持微信登录，自动读取所选会话。" action={{label:'选择会话',onPress:manage}}/></div>:<div className={'wechat-columns '+(selected?'has-selection':'')}>
      <ScrollShadow className="chat-list" aria-label="正在跟踪的会话">{chats.map(row=><Button key={row.id} variant={chat?.id===row.id?'secondary':'ghost'} className="chat-row" aria-current={chat?.id===row.id} onPress={()=>setSelected(row.id)}><span className="chat-avatar" aria-hidden="true">{row.name.slice(0,1)}</span><span className="chat-row-text"><strong>{row.name}{row.unread&&<span className="unread-dot" role="img" aria-label="本便笺未读"/>}</strong><span>{text(row.latest)}</span></span>{row.latest&&<time>{clock(row.latest.time)}</time>}</Button>)}</ScrollShadow>
      <article className="conversation">
        <header className="conversation-header" data-location-chat={chat?.id} tabIndex={-1}><Button className="back-chats" variant="ghost" onPress={()=>setSelected(null)}>返回会话</Button><div><h1>{chat?.name}</h1><p>只读</p></div></header>
        <MessageList key={`${chat?.id}:${selected??''}`} target={messageId}>
          {messageId&&messages.data&&messages.data.chat.id===chat?.id&&!messages.data.messages.some(row=>row.id===messageId)&&<p role="alert">目标消息不在当前可读取范围内。</p>}
          {messages.loading&&!messages.data&&<p role="status">正在读取消息…</p>}
          {messages.error&&<p role="alert">{messages.error.message}</p>}
          {chat&&<RelatedRecords recordId={chat.id}/>}
          {related.error&&<p role="alert">关联任务结果暂时无法读取。<Button variant="ghost" onPress={()=>void related.refresh()}>重试</Button></p>}
          {!messages.loading&&!messages.error&&!messages.data?.messages.length&&<p className="message-empty">暂无消息</p>}
          {messages.data?.messages.map((row,index,rows)=>{
            const showTime=index===0||row.time-rows[index-1]!.time>300;
            return <Fragment key={row.id}>
              {showTime&&<time className="message-time" dateTime={new Date(row.time*1000).toISOString()}>{new Date(row.time*1000).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>}
              <div id={'message-'+encodeURIComponent(row.id)} tabIndex={-1} aria-current={messageId===row.id?'true':undefined} style={messageId===row.id?{outline:'2px solid var(--wb-accent)',outlineOffset:4}:undefined} className={'message '+(row.fromMe?'from-me':'')}>
                <span className="message-avatar" aria-hidden="true">{row.fromMe?'我':(row.sender||chat?.name||'聊').slice(0,1)}</span>
                <div className="message-content">
                  <span className="message-sender">{row.fromMe?'我':row.sender||'对方'}</span>
                  <div className="message-body">{text(row)}</div>
                  {row.handling&&<p className="message-handling"><span>{row.handling.status==='followed'?'已跟进':'已略过'}</span>{row.handling.reason&&` · ${row.handling.reason}`}</p>}
                  {related.data?.filter(task=>task.messageIds.at(-1)===row.id).map(task=><TaskResult key={JSON.stringify([task.noteId,task.delegationId])} task={task}/>)}
                </div>
              </div>
            </Fragment>;
          })}
        </MessageList>
      </article>
    </div>}
  </section>;
}
export default View;
