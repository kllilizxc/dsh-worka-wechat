import {test,expect} from 'bun:test';
import {resolve} from 'node:path';
function run(code:string){const result=Bun.spawnSync(['python3','-c',`import runpy,json\nm=runpy.run_path(${JSON.stringify(resolve('bridge/mcp_bridge.py'))})\n${code}`]);expect(result.exitCode).toBe(0);return JSON.parse(result.stdout.toString());}
test('global discovery removes previews, contact names and sender information before crossing the bridge',()=>{
 const value=run(`data={'cursor':'session:synthetic','query':{'has_more':False},'events':[{'type':'session','session':{'username':'synthetic-id','summary':'private preview','display_name':'private contact','last_sender_wxid':'private sender'}}]}\nprint(json.dumps(m['read_scope']('read_events',{},data)))`);
 expect(value).toEqual({cursor:'session:synthetic',query:{has_more:false},events:[{session:{username:'synthetic-id'}}]});
});
test('selected message reads retain their content and cursor unchanged',()=>{
 const value=run(`data={'cursor':'local_id:1','events':[{'message':{'text':'selected synthetic message'}}]}\nprint(json.dumps(m['read_scope']('read_events',{'talker':'selected'},data)))`);
 expect(value).toEqual({cursor:'local_id:1',events:[{message:{text:'selected synthetic message'}}]});
});
