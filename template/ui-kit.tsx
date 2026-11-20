import { createContext, useContext, type ComponentProps, type ReactNode, type Ref } from 'react';
import { Button as HostButton } from '@/components/ui/button';
import { Input as HostInput } from '@/components/ui/input';

/**
 * The few controls this note uses, on Worka's own components. Worka no longer ships HeroUI to notes,
 * so these keep HeroUI's prop names (onPress, isDisabled, variant) and leave the screens unchanged.
 */
type Variant = 'primary' | 'secondary' | 'ghost' | 'tertiary';
const VARIANT = { primary: 'default', secondary: 'secondary', ghost: 'ghost', tertiary: 'outline' } as const;

export function Button({ variant = 'primary', size, isDisabled, onPress, ...props }: Omit<ComponentProps<typeof HostButton>, 'variant' | 'size'> & {
  variant?: Variant; size?: 'sm' | 'md'; isDisabled?: boolean; onPress?: () => void;
}) {
  return <HostButton {...props} variant={VARIANT[variant]} size={size === 'sm' ? 'sm' : 'default'} disabled={isDisabled} onClick={onPress} />;
}

export function ScrollShadow({ ref, style, ...props }: ComponentProps<'div'> & { ref?: Ref<HTMLDivElement> }) {
  return <div ref={ref} {...props} style={{ overflowY: 'auto', ...style }} />;
}

const Search = createContext<{ value: string; onChange(value: string): void }>({ value: '', onChange() {} });

function SearchFieldRoot({ value, onChange, children, fullWidth, ...props }: Omit<ComponentProps<'div'>, 'onChange'> & {
  value: string; onChange(value: string): void; fullWidth?: boolean; children: ReactNode;
}) {
  return <Search.Provider value={{ value, onChange }}><div role="search" {...props} style={{ width: fullWidth ? '100%' : undefined, ...props.style }}>{children}</div></Search.Provider>;
}

export const SearchField = Object.assign(SearchFieldRoot, {
  Group: ({ children }: { children: ReactNode }) => <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>,
  SearchIcon: () => <span aria-hidden="true" style={{ opacity: .6 }}>⌕</span>,
  Input: (props: ComponentProps<'input'>) => {
    const search = useContext(Search);
    return <HostInput type="search" {...props} value={search.value} onChange={event => search.onChange(event.currentTarget.value)} />;
  },
  ClearButton: (props: ComponentProps<'button'>) => {
    const search = useContext(Search);
    return search.value ? <HostButton type="button" variant="ghost" size="sm" {...props} onClick={() => search.onChange('')}>×</HostButton> : null;
  },
});
