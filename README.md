# Worka 微信只读便笺

独立 DSH 插件，注册 `wechat` 后台能力。需 Worka 0.3、Node 24、macOS arm64，以及已单独验证的本机读取运行环境。

## 安装

便笺市场来源为 `https://github.com/kllilizxc/dsh-worka-wechat/tree/main/template`。市场仅安装便笺界面，读取后台仍需安装到运行 Worka 的同一个 DSH profile；不会自动获取数据库密钥或初始化微信。

1. 先单独审核并初始化本机 `wechat-local-agent-mcp`、`wechat-cli`、WCDB 库和 Python 环境，确认能只读获取当前微信版本的消息。运行组件放在持久目录。保持 SIP 开启，不保存管理员密码。
2. 创建 `~/.config/worka-wechat/runtime.json`，权限设为 `0600`，替换以下示意路径。`python` 所指解释器需已安装 MCP 所需依赖；`metadata_state` 是独立的本机元数据目录。数据库密钥留在读取组件自己的私有配置中，不填入本文件。

   ```json
   {
     "python": "/absolute/path/to/python",
     "project": "/absolute/path/to/wechat-local-agent-mcp",
     "cli": "/absolute/path/to/wechat-cli",
     "wcdb": "/absolute/path/to/libwcdb.dylib",
     "metadata_state": "/absolute/path/to/wechat-metadata"
   }
   ```

3. 将本仓库作为 Worka 的仓库插件安装来源，按宿主安装流程构建并安装后台。手工安装时，用 Bun 执行 `bun run build`、`bun pm pack`，将生成的本地插件包安装到运行 Worka 的 DSH profile，并加载包内的 `cordis.patch.yml`。后台依赖宿主提供的 `@realiz3r/worka >=0.3.0 <0.4.0` 和 `@deepseek-ai/dsh-subprocess >=0.2.0-rc.2 <0.3.0`；本项目不在 npm 发布。确认宿主已挂载 `wechat` 能力。
4. 在便笺市场添加“微信”。点击“一键 AI 初始化”可复用已配置的本机读取后台，验证读取状态并恢复同步；没有已选会话时只选择文件传输助手。初始化不返回聊天正文，不开启 AI 自动处理。需要调整范围时，在便笺里点“选择会话”，勾选后“保存并读取”。单纯添加界面不会自动读取消息。

当前每个 Worka 宿主仅支持一个微信便笺。已有微信便笺时继续使用原便笺，不重复安装；发布到市场不会迁移或覆盖已有实例。

## 读取与隐私

数据链路：Worka 后台同步 → DSH 管理的本机沙箱进程 → wechat-local-agent-mcp → wechat-cli → 微信本地数据库。
便笺只读取已选私聊和群聊，默认每 5 秒一次。MCP 仅走 stdio，进程与子进程禁止联网。
插件直接使用 DSH 的 subprocess 服务管理进程范围和退出清理，再施加一层禁网沙箱；避免 macOS 拒绝嵌套沙箱。

本机配置 `~/.config/worka-wechat/runtime.json` 必须为 0600，包含 `python`、`project`（MCP 源码）、`cli`、`wcdb`、`metadata_state` 的绝对路径。运行文件不得位于临时目录。数据库密钥由已审核的本机组件保存在 `~/.config/wxcli/config.json`，不进入本仓库。配置、联系人和日志不得提交或上传。默认仅本机查看；用户明确授权并批准连线后，已选会话的新文字消息可进入该连线 AI 上下文。本人发送且会话 ID 不是 filehelper 的消息不触发连线；文件传输助手按稳定 ID 判断。聊天资料不上传到代码仓库或其他网站。

经过本机验证的组合：WeChat 4.1.13 (269602)、wechat-local-agent-mcp 0.4.0 commit b7c1de20462e87a80e6c45b86eb17c7d1230d500、wechat-cli 1.6.25。它们均非腾讯官方接口。
首次初始化需要单独审核：使用移除了密码持久化的 wxkey 安全构建，适配中文“微信.app”路径，由 macOS 原生授权窗口授权。保持 SIP 开启、原版签名不变。不执行上游自动安装/升级或 bootstrap；升级微信后重新验证兼容性。

插件运行期间仅开放 status、sessions、timeline、read_events，严格只读，媒体/OCR/语音/文件提取和联网均关闭。账号变化停止沿用原游标，先清除选中会话再重新选择。
消息与游标在同一原子文件替换中提交，避免失败或重启后漏读；按会话稳定 ID 与 local_id 去重。最多 20 个会话，每个保存最近 200 条，初次读取最近 50 条。卸载停止子进程与同步；便笺和本机资料保留。

构建：`bun run build`。定向验证：`bun test tests/backend.test.ts tests/source.test.ts`。测试使用合成数据；真实验证只输出脱敏计数。

## 验证范围与开发

已验证群聊真实入站、私聊历史和出站增量、自动轮询、暂停/恢复、重启续读和去重。私聊新入站及长期运行稳定性尚未完成验证；不能据此承诺所有微信版本都兼容。

后台构建与定向测试使用 Bun，不需要下载微信组件。`bun run typecheck` 需要开发依赖及兼容的 Worka/DSH peer 类型；便笺界面使用宿主自带 SDK，在 Worka 激活时构建和检查。仓库不包含任何用户配置、密钥、聊天数据或机器专属路径。
