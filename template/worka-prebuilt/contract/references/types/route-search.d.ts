import { type CompositionEvent, type FocusEvent } from 'react';
/** Short input buffer: the admitted URL remains the source of query results. */
export declare function useRouteSearch(): {
    value: string;
    setValue: (next: string) => void;
    inputProps: {
        onCompositionStart(): void;
        onCompositionEnd(event: CompositionEvent<HTMLInputElement>): void;
        onBlur(_event: FocusEvent<HTMLInputElement>): void;
    };
    params: () => URLSearchParams;
    flush: () => URLSearchParams;
};
