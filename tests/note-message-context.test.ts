import {expect,test} from 'bun:test';
import {selectBatch} from '../template/batch';

test('a batch excludes older and later context and refuses missing boundaries',()=>{
 const messages=['1','2','3','4'].map(id=>({id}));
 expect(selectBatch(messages,'1','3')).toEqual(messages.slice(1,3));
 expect(selectBatch(messages,null,'2')).toEqual(messages.slice(0,2));
 expect(()=>selectBatch(messages,'missing','3')).toThrow('批次边界');
 expect(()=>selectBatch(messages,'3','2')).toThrow('批次边界');
 expect(()=>selectBatch(messages,'3','3')).toThrow('批次边界');
});
