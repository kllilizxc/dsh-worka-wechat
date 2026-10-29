---
name: worka-wechat
description: 查看已选微信会话、管理本机读取与未来消息事件，并记录本地处理反馈。
---

# 微信便笺

只读本机微信文字消息，最多选择 20 个会话，每个会话最多保留 200 条缓存消息。媒体消息显示类型提示。消息由 `worka-wechat` provider 管理；本地未读位置和处理回执归当前便笺。便笺自身不选择连线目标、不查询其他便笺的任务，也不发送微信消息。

## 查询

- `status({})`：读取同步开关、暂停、错误和选择数量；不读取消息。
- `chats({query?})`：读取当前便笺已选择会话的稳定 ID。
- `item({id})`、`context({id})`：读取指定已选会话的缓存和本地处理反馈。
- `inbox({})`、`messages({chatId})`：读取本地缓存及此便笺的未读位置；不会启动实时读取。
- `sessions({keyword,offset})`：分页读取接入后的会话元数据。
- `related({id})`：仅从本便笺已有处理回执构造任务摘要；结果由关系回写，不跨便笺读取。

## 操作

- `selectChats({chats})`：只更新本消费者的会话选择。
- `setEnabled({enabled})`：暂停或恢复本消费者的读取。
- `refresh({})`：实时读取所选会话；失败时不推进 provider 游标。
- `markRead({chatId,messageId})`：保存本便笺已读位置，不改微信客户端状态。
- `recordHandling({id,messageId,status,reason,task?,taskStatus?,taskSummary?,taskRevision?})`：保存来源消息的跟进或略过回执；只写当前便笺本地 DB。

## 事件

`items.changed` 表示已选会话中有新消息（包括本人发送及媒体类型），包含稳定会话 ID、消息 ID、标题和 revision。连线读取上下文，并以自己的订阅和消费位置决定是否行动；本便笺不启动跨便笺分发。

首次使用由便笺声明的 `extension.worka-wechat.status` 前置条件交给 Worka 统一初始化。Provider 共享读取组件准备和账号验证，分别接入各便笺；需要本机授权或微信扫码时使用系统入口。失败时交给 Agent 修复，保留真实阶段与原因。Agent 可通过宿主扩展入口 `worka-wechat.initialize` 继续同一初始化流程；便笺 `initialize({})` 也复用同一初始化流程，只返回 ready/selected。只有真实状态验证通过后才确认完成，不把文件存在或安装成功当成完成；密码、密钥和消息正文不进入对话。provider 缓存单消息正文最多 16,000 字符；完整历史和业务台账仍保存在原有存储。

SDK3 查询只读已发布快照；需要首次装载时调用 `loadSnapshot({query,input})`，不调用 bind 或重复初始化。实时刷新使用 `refresh`。处理回执与已读游标保存在当前便笺原生集合；未知消息不得写入回执。

文件传输助手中本人发送的消息可作为指令；本人发给他人的消息是上下文。连线应结合完整会话和自己的约定判断。
