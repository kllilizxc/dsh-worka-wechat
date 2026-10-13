import {useEffect,useState} from 'react';
import {useNote} from '@dsh-workbench/react';

import type {RelatedTask} from './model';
import {Button} from '@heroui/react';

const labels:Record<string,string>={dispatching:'正在交办',running:'处理中',completed:'本轮结束',review:'待核对',blocked:'处理受阻','needs-input':'需要补充',paused:'已暂停',failed:'执行失败',cancelled:'已停止',unknown:'状态待核对'};

export function TaskResult({task}:{task:RelatedTask}) {
  const {host:workbench}=useNote();
  const [copied,setCopied]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{setCopied(false);setError('');},[task.replySuggestion]);
  const open=()=>workbench.openNote(task.noteId,task.delegationId).catch(value=>setError(String(value)));
  return <section className="task-result" aria-label="推荐回复">
    <header><strong>{task.replySuggestion?'推荐回复':labels[task.status]??'任务'}</strong></header>
    <p className={task.replySuggestion?'reply-suggestion':'task-summary'}>{task.replySuggestion||task.summary||'暂无进展'}</p>
    <footer>{task.replySuggestion&&<Button variant="ghost" onPress={()=>{void workbench.copyText(task.replySuggestion).then(()=>{setCopied(true);setError('');},()=>setError('复制失败，请选中文字复制'));}}>{copied?'已复制':'复制'}</Button>}
      <Button variant="ghost" onPress={()=>void open()}>查看任务</Button></footer>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
