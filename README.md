# Worka 微信只读便笺

独立 DSH 插件，注册 `wechat` 后台能力。需 Worka 0.3、Node 24、macOS arm64，以及已单独验证的本机读取运行环境。

数据链路：Worka 后台同步 → DSH 管理的本机沙箱进程 → wechat-local-agent-mcp → wechat-cli → 微信本地数据库。
便笺只读取已选私聊和群聊，默认每 5 秒一次。MCP 仅走 stdio，进程与子进程禁止联网。

本机配置 `~/.config/worka-wechat/runtime.json` 必须为 0600，包含 `python`、`project`（MCP 源码）、`cli`、`wcdb`、`metadata_state` 的绝对路径。运行文件不得位于临时目录。数据库密钥由已审核的本机组件保存在 `~/.config/wxcli/config.json`，不进入本仓库。配置、聊天内容、联系人和日志不得提交、上传或注入模型上下文。

经过本机验证的组合：WeChat 4.1.13 (269602)、wechat-local-agent-mcp 0.4.0 commit b7c1de20462e87a80e6c45b86eb17c7d1230d500、wechat-cli 1.6.25。它们均非腾讯官方接口。
首次初始化需要单独审核：使用移除了密码持久化的 wxkey 安全构建，适配中文“微信.app”路径，由 macOS 原生授权窗口授权。保持 SIP 开启、原版签名不变。不执行上游自动安装/升级或 bootstrap；升级微信后重新验证兼容性。

插件运行期间仅开放 status、sessions、timeline、read_events，严格只读，媒体/OCR/语音/文件提取和联网均关闭。账号变化停止沿用原游标，先清除选中会话再重新选择。
消息与游标在同一原子文件替换中提交，避免失败或重启后漏读；按会话稳定 ID 与 local_id 去重。最多 20 个会话，每个保存最近 200 条，初次读取最近 50 条。卸载停止子进程与同步；便笺和本机资料保留。

构建：`bun run build`。定向验证：`bun test tests/backend.test.ts tests/source.test.ts`。测试使用合成数据；真实验证只输出脱敏计数。
