import { z } from '@dsh-workbench/runtime';
export { note } from './model';
export declare const background: import("@dsh-workbench/runtime").BoundBackground;
export declare const queries: {
    connection: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        initialized: z.ZodBoolean;
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    status: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        enabled: z.ZodBoolean;
        paused: z.ZodBoolean;
        error: z.ZodNullable<z.ZodString>;
        nextRunAt: z.ZodNullable<z.ZodNumber>;
        selectedCount: z.ZodNumber;
        authorized: z.ZodBoolean;
        automatic: z.ZodBoolean;
        since: z.ZodNumber;
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    chats: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
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
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    related: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
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
    }, z.core.$strip>>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    routing: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
        enabled: z.ZodBoolean;
        since: z.ZodNumber;
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    item: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
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
                    recordedAt: z.ZodNumber;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
            messageIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>;
        revision: z.ZodString;
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    context: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
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
                recordedAt: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    inbox: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
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
                    recordedAt: z.ZodNumber;
                }, z.core.$strip>>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    messages: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
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
                recordedAt: z.ZodNumber;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
    sessions: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
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
    }, z.core.$strip>, import("@dsh-workbench/runtime").NoteQueryContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
};
export declare const initialize: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
    ready: z.ZodBoolean;
    selected: z.ZodNumber;
}, z.core.$strip>, import("@dsh-workbench/runtime").NoteActionContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
export declare const setEnabled: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    enabled: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    enabled: z.ZodBoolean;
}, z.core.$strip>, import("@dsh-workbench/runtime").NoteActionContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
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
}, z.core.$strip>, import("@dsh-workbench/runtime").NoteActionContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
export declare const refresh: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{}, z.core.$strip>, z.ZodObject<{
    refreshed: z.ZodBoolean;
}, z.core.$strip>, import("@dsh-workbench/runtime").NoteActionContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
export declare const autoConfigure: import("@dsh-workbench/runtime").NoteOperation<z.ZodObject<{
    enabled: z.ZodBoolean;
}, z.core.$strip>, z.ZodObject<{
    enabled: z.ZodBoolean;
    since: z.ZodNumber;
}, z.core.$strip>, import("@dsh-workbench/runtime").NoteActionContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
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
        recordedAt: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>, import("@dsh-workbench/runtime").NoteActionContext<import("@dsh-workbench/runtime").NoteModel<undefined, undefined, {}>>>;
export declare const events: {
    changed: Readonly<import("@dsh-workbench/runtime").NoteEvent<z.ZodObject<{
        itemId: z.ZodString;
        title: z.ZodString;
        messageId: z.ZodString;
        revision: z.ZodString;
    }, z.core.$strip>>>;
};
