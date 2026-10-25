import { useLayoutEffect, useRef, useState, type CompositionEvent, type FocusEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Short input buffer: the admitted URL remains the source of query results. */
export function useRouteSearch() {
  const location = useLocation(), navigate = useNavigate();
  const [value, setValue] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  const text = useRef(value), at = useRef(location);
  at.current = location;
  const own = useRef(new Set<string>());
  const composing = useRef(false), cancelledComposition = useRef(false);
  const ignoredCompositionValue = useRef<string | undefined>(undefined);
  const params = () => {
    const next = new URLSearchParams(at.current.search);
    if (text.current) next.set('q', text.current); else next.delete('q');
    next.delete('cursor');
    next.delete('offset');
    return next;
  };
  const submit = () => {
    const next = params(), search = next.size ? '?' + next.toString() : '';
    const href = at.current.pathname + search;
    if (search !== at.current.search) {
      own.current.add(href);
      if (own.current.size > 64) own.current.delete(own.current.values().next().value!);
      navigate({ pathname: at.current.pathname, search }, { replace: true });
    }
    return next;
  };
  useLayoutEffect(() => {
    const href = location.pathname + location.search;
    if (own.current.delete(href)) {
      if ((new URLSearchParams(location.search).get('q') ?? '') === text.current) own.current.clear();
      return; // An earlier admitted keystroke cannot roll back later text.
    }
    own.current.clear();
    if (composing.current) cancelledComposition.current = true;
    composing.current = false;
    text.current = new URLSearchParams(location.search).get('q') ?? '';
    setValue(text.current);
  }, [location.key, location.pathname, location.search]);
  const change = (next: string) => {
    if (cancelledComposition.current) return;
    if (ignoredCompositionValue.current !== undefined) {
      const ignored = ignoredCompositionValue.current; ignoredCompositionValue.current = undefined;
      if (next === ignored) return;
    }
    text.current = next; setValue(next);
    if (!composing.current) submit();
  };
  const flush = () => { composing.current = false; return submit(); };
  const inputProps = {
    onCompositionStart() { composing.current = true; cancelledComposition.current = false; ignoredCompositionValue.current = undefined; },
    onCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
      composing.current = false;
      if (cancelledComposition.current) {
        cancelledComposition.current = false;
        ignoredCompositionValue.current = event.currentTarget.value;
        event.currentTarget.value = text.current;
        return;
      }
      change(event.currentTarget.value);
    },
    onBlur(_event: FocusEvent<HTMLInputElement>) { if (!cancelledComposition.current) flush(); },
  };
  return { value, setValue: change, inputProps, params, flush };
}
