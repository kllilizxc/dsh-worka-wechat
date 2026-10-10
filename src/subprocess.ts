import type {SubprocessRuntime} from '@deepseek-ai/dsh-subprocess';
import type {RuntimeHost} from '@realiz3r/worka/host';

/** Provider-owned DSH processes. LocalMcp supplies the single OS sandbox policy. */
export function providerRuntime(native:Pick<SubprocessRuntime,'spawn'>):Pick<RuntimeHost,'subprocess'>{
  return {subprocess:{spawn:async spec=>{
    const handle=await native.spawn({argv:[spec.command,...spec.args],cwd:spec.cwd!,env:spec.env,
      graceMs:3000,stdio:{stdin:'pipe',stdout:'pipe',stderr:'pipe'}});
    let inputError:Error|undefined;
    handle.stdin!.on('error',error=>{inputError=error;});
    return {stdin:{write:chunk=>new Promise<void>((resolve,reject)=>{
      if(inputError){reject(inputError);return;}
      handle.stdin!.write(chunk,error=>error?reject(error):resolve());
    })},stdout:handle.stdout!,stderr:handle.stderr,
      wait:async()=>{const result=await handle.done;return {code:result.exitCode,signal:result.signal??undefined};},
      kill:async()=>{handle.terminate();await handle.waitForExit();}};
  }}};
}
