import {useEffect} from 'react';
import {useNote,type QueryResult} from '@dsh-workbench/react';
import type {InputOf,OutputOf} from '@dsh-workbench/runtime';
type Operations=typeof import('./actions');
type QueryName={[K in keyof Operations]:Operations[K] extends {kind:'query'}?K:never}[keyof Operations];
export function usePublishedQuery<K extends QueryName>(name:K,input:InputOf<Operations[K]>,options:{enabled?:boolean}={}):QueryResult<OutputOf<Operations[K]>>{
 const {useQuery,actions}=useNote<Operations>();
 const result=useQuery(name,input,options) as QueryResult<OutputOf<Operations[K]>>;
 const key=JSON.stringify([name,input]);
 useEffect(()=>{if(options.enabled===false)return;void actions.loadSnapshot({query:name,input}).catch(()=>undefined);},[key,options.enabled]);
 return {...result,refresh:async()=>{await actions.loadSnapshot({query:name,input,refresh:true});await result.refresh();}};
}
