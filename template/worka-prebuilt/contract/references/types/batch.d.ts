export declare function selectBatch<T extends {
    id: string;
}>(messages: T[], fromMessageId: string | null, messageId: string): T[];
