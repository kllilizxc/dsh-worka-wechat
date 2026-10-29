import {expect,test} from 'bun:test';
import {capabilityDefinition,describeCapabilities} from '@dsh-workbench/runtime/internal';
import * as operations from '../template/actions';
describeCapabilities(operations);

test('connection context reads selected messages without consulting the old AI switch',async()=>{
 const chat={id:'filehelper',name:'File helper',type:'private'};
 const messages=[{id:'1',time:1,sender:'me',text:'hello',kind:'text',fromMe:true},{id:'2',time:2,sender:'me',text:'',kind:'image',fromMe:true}];
 const ctx:any={executionKind:'query',note:{id:'wechat'},data:{get:async()=>null},resources:{read:async({name}:any)=>{
   expect(name).toBe('extension.worka-wechat.messages');return {data:{chat,messages,updatedAt:2}};
 }}};
 expect(await capabilityDefinition(operations.context)!.execute!({id:'filehelper'},ctx)).toEqual({chat,messages});
});
