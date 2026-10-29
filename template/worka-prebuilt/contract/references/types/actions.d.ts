import { z } from '@dsh-workbench/runtime';
export { note } from './model';
export declare const connection: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
    initialized: z.ZodBoolean;
    error: z.ZodNullable<z.ZodString>;
}, z.core.$strip>, "query">;
export declare const status: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
    enabled: z.ZodBoolean;
    paused: z.ZodBoolean;
    error: z.ZodNullable<z.ZodString>;
    nextRunAt: z.ZodNullable<z.ZodNumber>;
    selectedCount: z.ZodNumber;
}, z.core.$strip>, "query">;
export declare const chats: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            group: "group";
            private: "private";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>, "query">;
export declare const related: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>, z.ZodArray<z.ZodObject<{
    noteId: z.ZodString;
    delegationId: z.ZodString;
    title: z.ZodString;
    status: z.ZodString;
    archived: z.ZodBoolean;
    summary: z.ZodString;
    replySuggestion: z.ZodString;
    revision: z.ZodString;
    messageIds: z.ZodArray<z.ZodString>;
}, z.core.$strip>>, "query">;
export declare const item: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    item: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        type: z.ZodEnum<{
            group: "group";
            private: "private";
        }>;
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
        messageIds: z.ZodArray<z.ZodString>;
    }, z.core.$strip>;
    revision: z.ZodString;
}, z.core.$strip>, "query">;
export declare const context: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    id: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    chat: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            group: "group";
            private: "private";
        }>;
    }, z.core.$strip>;
    messages: z.ZodArray<z.ZodObject<{
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
}, z.core.$strip>, "query">;
export declare const batch: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    id: z.ZodString;
    fromMessageId: z.ZodNullable<z.ZodString>;
    messageId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    chat: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            group: "group";
            private: "private";
        }>;
    }, z.core.$strip>;
    messages: z.ZodArray<z.ZodObject<{
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
}, z.core.$strip>, "query">;
export declare const inbox: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
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
}, z.core.$strip>, "query">;
export declare const messages: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    chatId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    chat: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            group: "group";
            private: "private";
        }>;
    }, z.core.$strip>;
    messages: z.ZodArray<z.ZodObject<{
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
}, z.core.$strip>, "query">;
export declare const sessions: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    keyword: z.ZodString;
    offset: z.ZodNumber;
}, z.core.$strip>, z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            group: "group";
            private: "private";
        }>;
    }, z.core.$strip>>;
    hasMore: z.ZodBoolean;
}, z.core.$strip>, "query">;
export declare const setEnabled: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    enabled: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    enabled: z.ZodBoolean;
}, z.core.$strip>, "action">;
export declare const selectChats: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    chats: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<{
            group: "group";
            private: "private";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    selected: z.ZodNumber;
}, z.core.$strip>, "action">;
export declare const refresh: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
    refreshed: z.ZodBoolean;
}, z.core.$strip>, "action">;
export declare const recordHandling: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    id: z.ZodString;
    messageId: z.ZodString;
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
}, z.core.$strip>, z.ZodObject<{
    itemId: z.ZodString;
    messageId: z.ZodString;
    handling: z.ZodObject<{
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
}, z.core.$strip>, "action">;
export declare const saveHandling: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    id: z.ZodString;
    messageId: z.ZodString;
    handling: z.ZodObject<{
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
}, z.core.$strip>, undefined, "mutation">;
export declare const initialize: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
    ready: z.ZodBoolean;
    selected: z.ZodNumber;
}, z.core.$strip>, "action">;
export declare const changed: Readonly<import("@dsh-workbench/runtime").NoteEvent<z.ZodObject<{
    itemId: z.ZodString;
    chatId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    fromMessageId: z.ZodNullable<z.ZodString>;
    messageId: z.ZodString;
    revision: z.ZodString;
}, z.core.$strip>>>;
export declare const markRead: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    chatId: z.ZodString;
    messageId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    readThrough: z.ZodNumber;
}, z.core.$strip>, "action">;
export declare const advanceReadCursor: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    chatId: z.ZodString;
    messageId: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    readThrough: z.ZodNumber;
}, z.core.$strip>, "mutation">;
export declare const loadSnapshot: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    query: z.ZodEnum<{
        batch: "batch";
        chats: "chats";
        connection: "connection";
        context: "context";
        inbox: "inbox";
        item: "item";
        messages: "messages";
        related: "related";
        sessions: "sessions";
        status: "status";
    }>;
    input: z.ZodDefault<z.ZodJSONSchema>;
    refresh: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>, undefined, "action">;
