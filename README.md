# 微信便笺

本便笺通过 `@realiz3r/worka-provider-wechat` 只读本机微信。初始化由 provider 完成，连接后选择要同步的会话。已选会话的每条新消息都是来源事实，包含发送者、`fromMe` 和 `kind`；连线根据自身订阅与约定判断如何处理。文件传输助手中本人发送的消息可作为指令，本人发给他人的消息作为上下文。

消息和凭据保存在本机，不发送微信消息。使用说明见 [template/README.md](template/README.md)。
