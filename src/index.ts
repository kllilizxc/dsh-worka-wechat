import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WechatBackend} from './backend';
import {LocalMcp} from './source';
import {providerRuntime} from './subprocess';
export const name='dsh-worka-wechat';
export const inject=['worka','skills','subprocess'];
export async function apply(ctx:any,config:{runtimeConfig?:string}={}){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const backend=new WechatBackend(ctx.worka,new LocalMcp(providerRuntime(ctx.subprocess),resolve(root,'bridge/mcp_bridge.py'),config.runtimeConfig));
  backend.template=resolve(root,'template');
  try{
    await backend.start();const dispose=await ctx.worka.register('wechat',backend);ctx.effect(()=>dispose,'WeChat read-only backend');
    const stop=ctx.skills.register({name:'worka-wechat',description:'本机微信只读便笺，需要 Worka 和已验证的本机微信读取组件。',
      source:'bundled',path:resolve(root,'README.md'),resourceBase:{kind:'directory',path:root},
      content:'# 微信只读便笺\n使用本插件 template 创建并激活微信便笺。先用 status 核对接入状态；AI 授权后用 chats 查已选会话 ID，再用 item/context 读取，不能凭没有事件判断未接入。默认仅本机查看。用户明确授权后，已选会话的新文字消息可进入已批准连线，形成待办、协调执行台并保存本地反馈。本人发送的消息仅在目标会话 ID 为 filehelper 时触发；发给其他私聊或群聊不触发。不读取联系人、未选会话、凭据或私有数据文件，不发送回复，不上传到代码仓库或其他网站。初始化只允许已审核的安全组件；不执行上游自动 bootstrap、不保存管理员密码、不关闭 SIP。'});
    ctx.effect(()=>stop,'WeChat skill');
  }catch(error){await backend.close();throw error;}
}
