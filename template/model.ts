import {defineNote,z} from '@dsh-workbench/runtime';
export const chatSchema=z.object({id:z.string(),name:z.string(),type:z.enum(['private','group'])});
export const messageSchema=z.object({id:z.string(),time:z.number(),sender:z.string(),text:z.string(),kind:z.string(),fromMe:z.boolean()});
export const inboxSchema=z.object({enabled:z.boolean(),paused:z.boolean(),error:z.string().nullable(),nextRunAt:z.number().nullable(),
  chats:z.array(chatSchema.extend({count:z.number(),latest:messageSchema.nullable()}))});
export type Chat=z.infer<typeof chatSchema>;
export type Message=z.infer<typeof messageSchema>;
export type Inbox=z.infer<typeof inboxSchema>;
// No contacts, names, bodies or local credentials in note state or model context.
export const note=defineNote({});
