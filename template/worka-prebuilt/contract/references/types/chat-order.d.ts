import type { Message } from './model';
export declare const readKey: (chatId: string) => string;
export declare const latestFirst: <T extends {
    id: string;
    latest: Message | null;
}>(chats: readonly T[]) => T[];
export declare const unreadSince: (messages: readonly Message[], readThrough: number) => boolean;
export declare const advanceRead: (current: number | undefined, messageId: string) => number;
