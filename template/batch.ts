export function selectBatch<T extends {id:string}>(messages:T[], fromMessageId:string|null, messageId:string):T[] {
  const start = fromMessageId === null ? -1 : messages.findIndex(message => message.id === fromMessageId);
  const end = messages.findIndex(message => message.id === messageId);
  if ((fromMessageId !== null && start < 0) || end <= start) throw Error('消息批次边界不在缓存中，无法安全判断本批新增消息。');
  return messages.slice(start + 1, end + 1);
}
