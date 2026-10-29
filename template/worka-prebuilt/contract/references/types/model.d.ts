import { z } from '@dsh-workbench/runtime';
export declare const chatSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<{
        group: "group";
        private: "private";
    }>;
}, z.core.$strip>;
export declare const handlingSchema: z.ZodObject<{
    status: z.ZodEnum<{
        followed: "followed";
        skipped: "skipped";
    }>;
    reason: z.ZodString;
    task: z.ZodOptional<z.ZodObject<{
        noteId: z.ZodString;
        objectId: z.ZodString;
    }, z.core.$strip>>;
    taskTitle: z.ZodOptional<z.ZodString>;
    taskStatus: z.ZodOptional<z.ZodString>;
    taskArchived: z.ZodOptional<z.ZodBoolean>;
    taskSummary: z.ZodOptional<z.ZodString>;
    taskRevision: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    replySuggestion: z.ZodOptional<z.ZodString>;
    recordedAt: z.ZodNumber;
}, z.core.$strip>;
export declare const messageSchema: z.ZodObject<{
    id: z.ZodString;
    time: z.ZodNumber;
    sender: z.ZodString;
    text: z.ZodString;
    kind: z.ZodString;
    fromMe: z.ZodBoolean;
    handling: z.ZodOptional<z.ZodObject<{
        status: z.ZodEnum<{
            followed: "followed";
            skipped: "skipped";
        }>;
        reason: z.ZodString;
        task: z.ZodOptional<z.ZodObject<{
            noteId: z.ZodString;
            objectId: z.ZodString;
        }, z.core.$strip>>;
        taskTitle: z.ZodOptional<z.ZodString>;
        taskStatus: z.ZodOptional<z.ZodString>;
        taskArchived: z.ZodOptional<z.ZodBoolean>;
        taskSummary: z.ZodOptional<z.ZodString>;
        taskRevision: z.ZodOptional<z.ZodString>;
        sessionId: z.ZodOptional<z.ZodString>;
        replySuggestion: z.ZodOptional<z.ZodString>;
        recordedAt: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const inboxSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    paused: z.ZodBoolean;
    error: z.ZodNullable<z.ZodString>;
    nextRunAt: z.ZodNullable<z.ZodNumber>;
    chats: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            group: "group";
            private: "private";
        }>;
        count: z.ZodNumber;
        latest: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            time: z.ZodNumber;
            sender: z.ZodString;
            text: z.ZodString;
            kind: z.ZodString;
            fromMe: z.ZodBoolean;
            handling: z.ZodOptional<z.ZodObject<{
                status: z.ZodEnum<{
                    followed: "followed";
                    skipped: "skipped";
                }>;
                reason: z.ZodString;
                task: z.ZodOptional<z.ZodObject<{
                    noteId: z.ZodString;
                    objectId: z.ZodString;
                }, z.core.$strip>>;
                taskTitle: z.ZodOptional<z.ZodString>;
                taskStatus: z.ZodOptional<z.ZodString>;
                taskArchived: z.ZodOptional<z.ZodBoolean>;
                taskSummary: z.ZodOptional<z.ZodString>;
                taskRevision: z.ZodOptional<z.ZodString>;
                sessionId: z.ZodOptional<z.ZodString>;
                replySuggestion: z.ZodOptional<z.ZodString>;
                recordedAt: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
        unread: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const statusSchema: z.ZodObject<{
    enabled: z.ZodBoolean;
    paused: z.ZodBoolean;
    error: z.ZodNullable<z.ZodString>;
    nextRunAt: z.ZodNullable<z.ZodNumber>;
    selectedCount: z.ZodNumber;
}, z.core.$strip>;
export type Chat = z.infer<typeof chatSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Inbox = z.infer<typeof inboxSchema>;
export declare const note: import("@dsh-workbench/runtime").NoteModel<{
    readonly handling: {
        schema: z.ZodObject<{
            status: z.ZodEnum<{
                followed: "followed";
                skipped: "skipped";
            }>;
            reason: z.ZodString;
            task: z.ZodOptional<z.ZodObject<{
                noteId: z.ZodString;
                objectId: z.ZodString;
            }, z.core.$strip>>;
            taskTitle: z.ZodOptional<z.ZodString>;
            taskStatus: z.ZodOptional<z.ZodString>;
            taskArchived: z.ZodOptional<z.ZodBoolean>;
            taskSummary: z.ZodOptional<z.ZodString>;
            taskRevision: z.ZodOptional<z.ZodString>;
            sessionId: z.ZodOptional<z.ZodString>;
            replySuggestion: z.ZodOptional<z.ZodString>;
            recordedAt: z.ZodNumber;
        }, z.core.$strip>;
    };
    readonly reads: {
        schema: z.ZodObject<{
            through: z.ZodNumber;
        }, z.core.$strip>;
    };
}, undefined>;
export declare const relatedTaskSchema: z.ZodObject<{
    noteId: z.ZodString;
    delegationId: z.ZodString;
    title: z.ZodString;
    status: z.ZodString;
    archived: z.ZodBoolean;
    summary: z.ZodString;
    replySuggestion: z.ZodString;
    revision: z.ZodString;
    messageIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type RelatedTask = z.infer<typeof relatedTaskSchema>;
