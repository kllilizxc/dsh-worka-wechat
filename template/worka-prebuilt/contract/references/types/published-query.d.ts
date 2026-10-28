import { type QueryResult } from '@dsh-workbench/react';
import type { InputOf, OutputOf } from '@dsh-workbench/runtime';
type Operations = typeof import('./actions');
type QueryName = {
    [K in keyof Operations]: Operations[K] extends {
        kind: 'query';
    } ? K : never;
}[keyof Operations];
export declare function usePublishedQuery<K extends QueryName>(name: K, input: InputOf<Operations[K]>, options?: {
    enabled?: boolean;
}): QueryResult<OutputOf<Operations[K]>>;
export {};
