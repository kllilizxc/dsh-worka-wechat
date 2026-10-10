import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WechatBackend} from './backend';
import {LocalMcp} from './source';
export const name='dsh-worka-wechat';
export const inject=['worka','skills'];
export async function apply(ctx:any,config:{runtimeConfig?:string}={}){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const backend=new WechatBackend(ctx.worka,new LocalMcp(ctx.worka.runtime,resolve(root,'bridge/mcp_bridge.py'),config.runtimeConfig));
  backend.template=resolve(root,'template');
  try{
    await backend.start();const dispose=await ctx.worka.register('wechat',backend);ctx.effect(()=>dispose,'WeChat read-only backend');
    const stop=ctx.skills.register({name:'worka-wechat',description:'本机微信只读便笺，需要 Worka 和已验证的本机微信读取组件。',
      source:'bundled',path:resolve(root,'README.md'),resourceBase:{kind:'directory',path:root},
      content:'# 微信只读便笺\n使用本插件 template 创建并激活微信便笺。聊天内容、联系人和群名仅供本机 UI，不能通过 AI 工具查询、上传或注入对话。不建立自动 AI 连线，不发送回复。初始化只允许已审核的安全组件；不执行上游自动 bootstrap、不保存管理员密码、不关闭 SIP。'});
    ctx.effect(()=>stop,'WeChat skill');
  }catch(error){await backend.close();throw error;}
}
