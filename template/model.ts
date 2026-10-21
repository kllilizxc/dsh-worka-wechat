import {defineNote,z} from '@dsh-workbench/runtime';
export const chatSchema=z.object({id:z.string(),name:z.string(),type:z.enum(['private','group'])});
export const handlingSchema=z.object({status:z.enum(['followed','skipped']),reason:z.string(),task:z.object({noteId:z.string(),objectId:z.string()}).optional(),recordedAt:z.number()});
export const messageSchema=z.object({id:z.string(),time:z.number(),sender:z.string(),text:z.string(),kind:z.string(),fromMe:z.boolean(),handling:handlingSchema.optional()});
export const inboxSchema=z.object({enabled:z.boolean(),paused:z.boolean(),error:z.string().nullable(),nextRunAt:z.number().nullable(),
  chats:z.array(chatSchema.extend({count:z.number(),latest:messageSchema.nullable(),unread:z.boolean()}))});
export const statusSchema=z.object({enabled:z.boolean(),paused:z.boolean(),error:z.string().nullable(),nextRunAt:z.number().nullable(),selectedCount:z.number().int().nonnegative(),authorized:z.boolean(),automatic:z.boolean(),since:z.number()});
export type Chat=z.infer<typeof chatSchema>;
export type Message=z.infer<typeof messageSchema>;
export type Inbox=z.infer<typeof inboxSchema>;
// Business queries project selected chats from the provider; raw messages and credentials stay out of generic state.
export const note=defineNote({});

export const relatedTaskSchema=z.object({noteId:z.string(),delegationId:z.string(),title:z.string(),status:z.string(),archived:z.boolean(),summary:z.string(),replySuggestion:z.string(),revision:z.string(),messageIds:z.array(z.string())});
export type RelatedTask=z.infer<typeof relatedTaskSchema>;
