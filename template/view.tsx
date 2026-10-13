import {useEffect,useLayoutEffect,useRef,useState,Fragment,type ReactNode} from 'react';
import {Button,SearchField,ScrollShadow} from '@heroui/react';
import {useNote,withNotePrerequisites,NoteIcon,NoteGuidance} from '@dsh-workbench/react';
import type {Chat,Message} from './model';
import {TaskResult} from './task';
import '@heroui/styles/css';
import './style.css';

const text=(message:Message|null)=>message?(message.text||`[${({image:'图片',voice:'语音',video:'视频',sticker:'表情',file:'文件'} as Record<string,string>)[message.kind]??'非文字消息'}]`):'尚未读取消息';
const clock=(time:number)=>new Date(time*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});

function MessageList({children}:{children:ReactNode}){
  const viewport=useRef<HTMLDivElement>(null);
  const content=useRef<HTMLDivElement>(null);
  const following=useRef(true);
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
  const {metadata,mode,host,actions,useQuery,focus}=useNote<typeof import('./actions')>();
  const [managing,setManaging]=useState(focus==='sessions');
  const [selected,setSelected]=useState<string|null>(null);
  const [keyword,setKeyword]=useState('');
  const [offset,setOffset]=useState(0);
  const [pending,setPending]=useState<Chat[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{if(focus==='sessions'&&mode==='expanded')setManaging(true);},[focus,mode]);
  const inbox=useQuery('inbox',{});
  const routing=useQuery('routing',{});
  const data=inbox.data;
  const chats=data?.chats??[];
  const chat=chats.find(row=>row.id===selected)??chats[0];
  const messages=useQuery('messages',{chatId:chat?.id??''},{enabled:mode==='expanded'&&!managing&&!!chat});
  const related=useQuery('related',{id:chat?.id??''},{enabled:mode==='expanded'&&!managing&&!!chat});
  const sessions=useQuery('sessions',{keyword,offset},{enabled:mode==='expanded'&&managing});
  const enabled=data?.enabled===true;
  const status=data?.paused?'已暂停':data?.error?'读取受阻':enabled?'读取中':'已暂停';
  const failure=error||inbox.error?.message||routing.error?.message||data?.error||'';
  const chosen=pending??chats.map(({id,name,type})=>({id,name,type}));
  const run=async(work:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await work();}catch(cause){setError(cause instanceof Error?cause.message:'操作失败，请重试。');}finally{setBusy(false);}};
  const manage=()=>{setPending(null);setManaging(true);};
  const toggle=(row:Chat)=>setPending(current=>{const value=current??chosen;return value.some(item=>item.id===row.id)?value.filter(item=>item.id!==row.id):[...value,row];});
  const save=()=>run(async()=>{await actions.selectChats({chats:chosen});if(chosen.length)await actions.setEnabled({enabled:true});setPending(null);setManaging(false);});
  const identity=<span className="wechat-identity"><NoteIcon icon={metadata.icon} size={20}/><strong>{metadata.name}</strong></span>;

  if(mode==='compact')return <section className="wechat compact">
    <header>{identity}<span className={'wechat-status '+(failure?'error':'')}>{failure?'读取受阻':status}</span></header>
    {!data&&!inbox.error?<p className="compact-empty">正在连接本机微信…</p>:!chats.length?<div className="compact-empty"><strong>选择会话</strong><p>自动读取所选会话的新消息。</p><Button size="sm" variant="secondary" onPress={()=>host.openNote(metadata.id,'sessions')}>选择会话</Button></div>:<>
      <div className="compact-chats">{[...chats].sort((a,b)=>(b.latest?.time??0)-(a.latest?.time??0)).slice(0,3).map(row=><div key={row.id} className="compact-chat"><strong>{row.name}</strong><span>{text(row.latest)}</span></div>)}</div>
      <footer><span>{chats.length} 个会话 · 只读</span>{failure?<Button size="sm" variant="ghost" onPress={()=>host.openNote(metadata.id)}>查看原因</Button>:<span>展开查看消息</span>}</footer>
    </>}
    {inbox.error&&!data&&<Button size="sm" variant="secondary" onPress={()=>host.openSetup()}>检查连接</Button>}
  </section>;

  return <section className="wechat expanded">
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
      <SearchField aria-label="搜索微信会话" value={keyword} onChange={value=>{setKeyword(value);setOffset(0);}} fullWidth>
        <SearchField.Group><SearchField.SearchIcon/><SearchField.Input placeholder="搜索私聊或群聊"/><SearchField.ClearButton aria-label="清空搜索"/></SearchField.Group>
      </SearchField>
      <ScrollShadow className="session-results">
        {chosen.length>0&&<div className="chosen-chats" aria-label="已选会话">{chosen.map(row=><Button key={row.id} variant="secondary" size="sm" isDisabled={busy} onPress={()=>toggle(row)} aria-label={`取消跟踪 ${row.name}`}>{row.name} ×</Button>)}</div>}
        {sessions.loading&&<p role="status">正在读取会话…</p>}
        {sessions.error&&<div role="alert"><p>{sessions.error.message}</p><Button variant="secondary" onPress={()=>void sessions.refresh()}>重新读取</Button></div>}
        {!sessions.loading&&!sessions.error&&!sessions.data?.items.length&&<p>没有找到匹配的私聊或群聊。</p>}
        <div className="session-list">{sessions.data?.items.map(row=>{const checked=chosen.some(item=>item.id===row.id);return <Button key={row.id} className="session-row" variant={checked?'secondary':'ghost'} aria-pressed={checked} isDisabled={busy||(!checked&&chosen.length>=20)} onPress={()=>toggle(row)}><span className="chat-avatar" aria-hidden="true">{row.name.slice(0,1)}</span><span className="chat-name">{row.name}</span><span className="chat-type">{row.type==='group'?'群聊':'私聊'}</span><span aria-hidden="true">{checked?'✓':'＋'}</span></Button>;})}</div>
      </ScrollShadow>
      <footer className="manage-footer"><div><Button variant="ghost" isDisabled={offset===0||sessions.loading} onPress={()=>setOffset(Math.max(0,offset-50))}>上一页</Button><Button variant="ghost" isDisabled={!sessions.data?.hasMore||sessions.loading} onPress={()=>setOffset(offset+50)}>下一页</Button></div><Button variant="primary" isDisabled={busy} onPress={()=>void save()}>{busy?'保存中…':chosen.length?'保存并读取':'清除已选会话'}</Button></footer>
    </section>:!chats.length?<div className="wechat-guidance"><NoteGuidance title="选择会话" description="保持微信登录，自动读取所选会话。" action={{label:'选择会话',onPress:manage}}/></div>:<div className={'wechat-columns '+(selected?'has-selection':'')}>
      <ScrollShadow className="chat-list" aria-label="正在跟踪的会话">{chats.map(row=><Button key={row.id} variant={chat?.id===row.id?'secondary':'ghost'} className="chat-row" aria-current={chat?.id===row.id} onPress={()=>setSelected(row.id)}><span className="chat-avatar" aria-hidden="true">{row.name.slice(0,1)}</span><span className="chat-row-text"><strong>{row.name}</strong><span>{text(row.latest)}</span></span>{row.latest&&<time>{clock(row.latest.time)}</time>}</Button>)}</ScrollShadow>
      <article className="conversation">
        <header className="conversation-header"><Button className="back-chats" variant="ghost" onPress={()=>setSelected(null)}>返回会话</Button><div><h1>{chat?.name}</h1><p>只读</p></div></header>
        <MessageList key={`${chat?.id}:${selected??''}`}>
          {messages.loading&&!messages.data&&<p role="status">正在读取消息…</p>}
          {messages.error&&<p role="alert">{messages.error.message}</p>}
          {related.error&&<p role="alert">关联任务结果暂时无法读取。<Button variant="ghost" onPress={()=>void related.refresh()}>重试</Button></p>}
          {!messages.loading&&!messages.error&&!messages.data?.messages.length&&<p className="message-empty">暂无消息</p>}
          {messages.data?.messages.map((row,index,rows)=>{
            const showTime=index===0||row.time-rows[index-1]!.time>300;
            return <Fragment key={row.id}>
              {showTime&&<time className="message-time" dateTime={new Date(row.time*1000).toISOString()}>{new Date(row.time*1000).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>}
              <div className={'message '+(row.fromMe?'from-me':'')}>
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
export default withNotePrerequisites(View,{configurationInView:true});
