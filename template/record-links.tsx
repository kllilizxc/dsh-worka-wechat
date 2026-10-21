import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {QueryState,useLinks,useMutation,useNote} from '@dsh-workbench/react';

/** Presentation only: the host owns the query and all association data. */
type RelatedRecordsProps={recordId:string;className?:string};

export function RelatedRecords(props:RelatedRecordsProps) {
  const anchor=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(typeof IntersectionObserver==='undefined');
  useEffect(()=>{
    const card=anchor.current?.parentElement;
    if(!card||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting));
    observer.observe(card);
    return()=>observer.disconnect();
  },[]);
  return <div ref={anchor} style={{display:'contents'}}>{visible&&<VisibleRelatedRecords {...props}/>}</div>;
}

function VisibleRelatedRecords({recordId,className}:RelatedRecordsProps) {
  const note=useNote();
  const query=useLinks(recordId);
  const navigation=useMutation();
  if(query.data && !query.links.length && !query.loading && !query.error)return null;
  return <div className={className} aria-label="关联记录" style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
    <QueryState query={query}>{() => query.links.map(link =>
      <Button key={link.id} size="sm" variant="tertiary" isDisabled={navigation.pending}
        onPress={() => void navigation.run(() => note.navigation.open({noteId:link.target.noteId,recordId:link.target.recordId}))}>
        {link.label} ↗
      </Button>)}</QueryState>
    {navigation.error && <p role="alert">无法打开关联记录：{navigation.error.message}</p>}
  </div>;
}
