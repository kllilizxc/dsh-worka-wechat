import {useEffect,useState} from 'react';
import {useNote} from '@dsh-workbench/react';

import type {RelatedTask} from './model';
import {Button} from '@heroui/react';

const labels:Record<string,string>={dispatching:'正在交办',running:'执行台处理中',completed:'本轮已结束',review:'待核对',blocked:'处理受阻','needs-input':'需要补充',paused:'已暂停',failed:'执行失败',cancelled:'已停止',unknown:'状态待核对'};

export function TaskResult({task}:{task:RelatedTask}) {
  const {host:workbench}=useNote();
  const [copied,setCopied]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setCopied(false);setError('');},[task.replySuggestion]);
  const open=()=>workbench.openNote(task.noteId,task.delegationId).catch(value=>setError(String(value)));
  return <section className="task-result" aria-label="执行台建议回复">
    <header><strong>{task.replySuggestion?'建议回复':labels[task.status]??'执行台任务'}</strong><span>执行台 · 仅你可见</span></header>
    <p className={task.replySuggestion?'reply-suggestion':'task-summary'}>{task.replySuggestion||task.summary||'处理进展请查看执行台任务。'}</p>
    <p className="task-summary">{task.title} · {task.archived?'已归档':labels[task.status]??task.status}</p>
    <footer>{task.replySuggestion&&<Button variant="ghost" onPress={()=>{void workbench.copyText(task.replySuggestion).then(()=>{setCopied(true);setError('');},()=>setError('复制失败，请选中文字复制'));}}>{copied?'已复制':'复制回复'}</Button>}
      <Button variant="ghost" onPress={()=>void open()}>查看执行台任务 ↗</Button></footer>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
