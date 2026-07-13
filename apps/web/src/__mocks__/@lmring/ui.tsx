import {
  type ComponentProps,
  cloneElement,
  createContext,
  createElement,
  type ElementType,
  forwardRef,
  type ReactElement,
  type ReactNode,
  useContext,
  useState,
} from 'react';

// Utility function
export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

// Hook mocks — mirrors @lmring/ui controllable state for unit tests
export const useControllableState = <T,>({
  prop,
  defaultProp,
  defaultValue,
  onChange,
}: {
  prop?: T;
  defaultProp?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
}) => {
  const [uncontrolled, setUncontrolled] = useState<T | undefined>(defaultProp ?? defaultValue);
  const isControlled = prop !== undefined;
  const value = isControlled ? prop : uncontrolled;

  const setValue = (next: T | ((prev: T | undefined) => T)) => {
    const resolved =
      typeof next === 'function' ? (next as (prev: T | undefined) => T)(value) : next;
    if (!isControlled) {
      setUncontrolled(resolved);
    }
    onChange?.(resolved);
  };

  return [value, setValue] as const;
};

// Simple wrapper component factory
const createWrapper = (testId?: string, tag: ElementType = 'div') =>
  forwardRef<HTMLElement, { children?: ReactNode; className?: string }>(
    ({ children, ...props }, ref) => {
      return createElement(tag, { ref, 'data-testid': testId, ...props }, children);
    },
  );

// Fragment wrapper - renders children without wrapper
const FragmentWrapper = ({ children }: { children?: ReactNode }) => <>{children}</>;

// Resizable components
export const ResizablePanelGroup = createWrapper('resizable-panel-group');
export const ResizablePanel = createWrapper('resizable-panel');
export const ResizableHandle = createWrapper('resizable-handle');

// Button
export const Button = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { variant?: string; size?: string }
>(({ children, ...props }, ref) => (
  <button ref={ref} type="button" {...props}>
    {children}
  </button>
));
Button.displayName = 'Button';
export const buttonVariants = () => '';

// Card components
export const Card = createWrapper('card');
export const CardHeader = createWrapper('card-header');
export const CardFooter = createWrapper('card-footer');
export const CardTitle = createWrapper('card-title');
export const CardDescription = createWrapper('card-description');
export const CardContent = createWrapper('card-content');

// Input
export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>((props, ref) => (
  <input ref={ref} {...props} />
));
Input.displayName = 'Input';

// Textarea
export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(
  (props, ref) => <textarea ref={ref} {...props} />,
);
Textarea.displayName = 'Textarea';

// Badge
export const Badge = forwardRef<HTMLSpanElement, ComponentProps<'span'>>(
  ({ children, ...props }, ref) => (
    <span ref={ref} {...props}>
      {children}
    </span>
  ),
);
Badge.displayName = 'Badge';
export const badgeVariants = () => '';

// Label
export const Label = forwardRef<HTMLLabelElement, ComponentProps<'label'>>(
  ({ children, ...props }, ref) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: Mock component
    <label ref={ref} {...props}>
      {children}
    </label>
  ),
);
Label.displayName = 'Label';

// Avatar
export const Avatar = createWrapper('avatar');
export const AvatarImage = forwardRef<HTMLImageElement, ComponentProps<'img'>>((props, ref) => (
  // biome-ignore lint/a11y/useAltText: Mock component
  // biome-ignore lint/performance/noImgElement: Mock component
  <img ref={ref} {...props} />
));
AvatarImage.displayName = 'AvatarImage';
export const AvatarFallback = createWrapper('avatar-fallback');

// Separator
export const Separator = createWrapper('separator', 'hr');

// Select components with Context for onValueChange
const SelectContext = createContext<{ onValueChange?: (value: string) => void }>({});
export const Select = ({
  children,
  onValueChange,
}: {
  children?: ReactNode;
  onValueChange?: (value: string) => void;
}) => <SelectContext.Provider value={{ onValueChange }}>{children}</SelectContext.Provider>;
export const SelectGroup = FragmentWrapper;
export const SelectValue = ({ placeholder }: { placeholder?: string }) => (
  <span>{placeholder}</span>
);
export const SelectTrigger = createWrapper('select-trigger', 'button');
export const SelectContent = createWrapper('select-content');
export const SelectLabel = createWrapper('select-label');
export const SelectItem = forwardRef<HTMLDivElement, ComponentProps<'div'> & { value: string }>(
  ({ children, value, onClick, ...props }, ref) => {
    const { onValueChange } = useContext(SelectContext);
    return (
      // biome-ignore lint/a11y/useKeyWithClickEvents: Mock component
      // biome-ignore lint/a11y/useFocusableInteractive: Mock component
      <div
        ref={ref}
        role="option"
        onClick={(e) => {
          onValueChange?.(value);
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SelectItem.displayName = 'SelectItem';
export const SelectSeparator = createWrapper('select-separator', 'hr');
export const SelectScrollUpButton = createWrapper('select-scroll-up', 'button');
export const SelectScrollDownButton = createWrapper('select-scroll-down', 'button');

// DropdownMenu components
export const DropdownMenu = FragmentWrapper;
export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { asChild?: boolean; children?: ReactNode }
>(({ children, asChild, ...props }, ref) => {
  if (asChild && children) {
    // Clone the child and add aria-haspopup
    const child = children as ReactElement<{ 'aria-haspopup'?: string }>;
    return cloneElement(child, { 'aria-haspopup': 'menu' });
  }
  return (
    <button ref={ref} type="button" aria-haspopup="menu" {...props}>
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';
export const DropdownMenuContent = () => null; // Hidden by default in tests
export const DropdownMenuItem = forwardRef<HTMLDivElement, ComponentProps<'div'>>(
  ({ children, ...props }, ref) => (
    // biome-ignore lint/a11y/useFocusableInteractive: Mock component
    <div ref={ref} role="menuitem" {...props}>
      {children}
    </div>
  ),
);
DropdownMenuItem.displayName = 'DropdownMenuItem';
export const DropdownMenuCheckboxItem = DropdownMenuItem;
export const DropdownMenuRadioItem = DropdownMenuItem;
export const DropdownMenuLabel = createWrapper('dropdown-label');
export const DropdownMenuSeparator = createWrapper('dropdown-separator', 'hr');
export const DropdownMenuShortcut = createWrapper('dropdown-shortcut', 'span');
export const DropdownMenuGroup = FragmentWrapper;
export const DropdownMenuPortal = FragmentWrapper;
export const DropdownMenuSub = FragmentWrapper;
export const DropdownMenuSubContent = createWrapper('dropdown-sub-content');
export const DropdownMenuSubTrigger = createWrapper('dropdown-sub-trigger');
export const DropdownMenuRadioGroup = FragmentWrapper;

// Popover components
export const Popover = FragmentWrapper;
export const PopoverTrigger = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) =>
  asChild ? (
    children
  ) : (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  ),
);
PopoverTrigger.displayName = 'PopoverTrigger';
export const PopoverContent = createWrapper('popover-content');
export const PopoverAnchor = FragmentWrapper;

// Slider (array-based API like Radix)
export const Slider = forwardRef<
  HTMLInputElement,
  Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
    value?: number[];
    onValueChange?: (value: number[]) => void;
  }
>(({ value, onValueChange, ...props }, ref) => (
  <input
    ref={ref}
    type="range"
    value={value?.[0]}
    onChange={(e) => onValueChange?.([Number(e.target.value)])}
    {...props}
  />
));
Slider.displayName = 'Slider';

// Switch (with onCheckedChange API like Radix)
export const Switch = forwardRef<
  HTMLInputElement,
  Omit<ComponentProps<'input'>, 'onChange'> & {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }
>(({ checked, onCheckedChange, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    role="switch"
    aria-checked={checked}
    checked={checked}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    {...props}
  />
));
Switch.displayName = 'Switch';

// Tooltip components
export const TooltipProvider = FragmentWrapper;
export const Tooltip = FragmentWrapper;
export const TooltipTrigger = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) =>
  asChild ? (
    children
  ) : (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  ),
);
TooltipTrigger.displayName = 'TooltipTrigger';
export const TooltipContent = createWrapper('tooltip-content');

// Dialog components
export const Dialog = ({ children, open }: { children?: ReactNode; open?: boolean }) =>
  open !== false ? children : null;
export const DialogPortal = FragmentWrapper;
export const DialogOverlay = createWrapper('dialog-overlay');
export const DialogClose = createWrapper('dialog-close', 'button');
export const DialogTrigger = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) =>
  asChild ? (
    children
  ) : (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  ),
);
DialogTrigger.displayName = 'DialogTrigger';
export const DialogContent = createWrapper('dialog-content');
export const DialogHeader = createWrapper('dialog-header');
export const DialogFooter = createWrapper('dialog-footer');
export const DialogTitle = createWrapper('dialog-title');
export const DialogDescription = createWrapper('dialog-description');

// AlertDialog components
export const AlertDialog = ({ children, open }: { children?: ReactNode; open?: boolean }) =>
  open ? <div data-testid="alert-dialog">{children}</div> : null;
export const AlertDialogPortal = FragmentWrapper;
export const AlertDialogOverlay = createWrapper('alert-dialog-overlay');
export const AlertDialogTrigger = DialogTrigger;
export const AlertDialogContent = createWrapper('alert-dialog-content');
export const AlertDialogHeader = createWrapper('alert-dialog-header');
export const AlertDialogFooter = createWrapper('alert-dialog-footer');
export const AlertDialogTitle = createWrapper('alert-dialog-title');
export const AlertDialogDescription = createWrapper('alert-dialog-description');
export const AlertDialogAction = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(
  ({ children, ...props }, ref) => (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  ),
);
AlertDialogAction.displayName = 'AlertDialogAction';
export const AlertDialogCancel = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(
  ({ children, ...props }, ref) => (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  ),
);
AlertDialogCancel.displayName = 'AlertDialogCancel';

// Tabs components
export const Tabs = createWrapper('tabs');
export const TabsList = createWrapper('tabs-list');
export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  ComponentProps<'button'> & { value: string }
>(({ children, ...props }, ref) => (
  <button ref={ref} type="button" role="tab" {...props}>
    {children}
  </button>
));
TabsTrigger.displayName = 'TabsTrigger';
export const TabsContent = forwardRef<HTMLDivElement, ComponentProps<'div'> & { value: string }>(
  ({ children, ...props }, ref) => (
    <div ref={ref} role="tabpanel" {...props}>
      {children}
    </div>
  ),
);
TabsContent.displayName = 'TabsContent';

// Command components
export const Command = createWrapper('command');
export const CommandDialog = Dialog;
export const CommandInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>((props, ref) => (
  <input ref={ref} {...props} />
));
CommandInput.displayName = 'CommandInput';
export const CommandList = createWrapper('command-list');
export const CommandEmpty = createWrapper('command-empty');
export const CommandGroup = forwardRef<
  HTMLDivElement,
  ComponentProps<'div'> & { heading?: string }
>(({ heading, children, ...props }, ref) => (
  <div ref={ref} data-testid="command-group" {...props}>
    {heading && <div data-testid="command-group-heading">{heading}</div>}
    {children}
  </div>
));
CommandGroup.displayName = 'CommandGroup';
export const CommandItem = forwardRef<
  HTMLDivElement,
  ComponentProps<'div'> & { onSelect?: () => void }
>(({ children, onSelect, onClick, ...props }, ref) => (
  // biome-ignore lint/a11y/useFocusableInteractive: Mock component
  // biome-ignore lint/a11y/useKeyWithClickEvents: Mock component
  <div
    ref={ref}
    role="option"
    cmdk-item=""
    onClick={(e) => {
      onSelect?.();
      onClick?.(e);
    }}
    {...props}
  >
    {children}
  </div>
));
CommandItem.displayName = 'CommandItem';
export const CommandShortcut = createWrapper('command-shortcut', 'span');
export const CommandSeparator = createWrapper('command-separator', 'hr');

// Collapsible components — lightweight open/close wiring for unit tests
const CollapsibleCtx = createContext<{
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}>({ open: false });

export const Collapsible = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  className?: string;
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(Boolean(defaultOpen));
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? Boolean(open) : uncontrolledOpen;

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <CollapsibleCtx.Provider value={{ open: resolvedOpen, onOpenChange: handleOpenChange }}>
      <div data-testid="collapsible" data-state={resolvedOpen ? 'open' : 'closed'} {...props}>
        {children}
      </div>
    </CollapsibleCtx.Provider>
  );
};

export const CollapsibleTrigger = forwardRef<HTMLButtonElement, ComponentProps<'button'>>(
  ({ children, onClick, ...props }, ref) => {
    const { open, onOpenChange } = useContext(CollapsibleCtx);
    return (
      <button
        ref={ref}
        type="button"
        {...props}
        onClick={(event) => {
          onOpenChange?.(!open);
          onClick?.(event);
        }}
      >
        {children}
      </button>
    );
  },
);
CollapsibleTrigger.displayName = 'CollapsibleTrigger';
export const CollapsibleContent = ({
  children,
  ...props
}: {
  children?: ReactNode;
  className?: string;
}) => {
  const { open } = useContext(CollapsibleCtx);
  if (!open) return null;
  return (
    <div data-testid="collapsible-content" {...props}>
      {children}
    </div>
  );
};

// ScrollArea components
export const ScrollArea = createWrapper('scroll-area');
export const ScrollBar = createWrapper('scroll-bar');

// ResponseViewer
export const ResponseViewer = ({
  content,
  className,
}: {
  content: string;
  className?: string;
  status?: string;
}) => (
  <div data-testid="response-viewer" className={className}>
    {content}
  </div>
);
export type ResponseViewerStatus = 'idle' | 'streaming' | 'complete' | 'error';

// Visual components
export const Shimmer = createWrapper('shimmer');
export const StreamingCursor = createWrapper('streaming-cursor', 'span');
export const Skeleton = ({ className }: { className?: string }) => (
  <div data-testid="skeleton" className={className} />
);

// Skeleton variants
export const ConversationCardSkeleton = ({ count }: { count?: number }) => (
  <div data-testid="conversation-skeleton" data-count={count} />
);
export const SidebarConversationSkeleton = () => <div data-testid="skeleton" />;
export const ProviderCardSkeleton = ({ count }: { count?: number }) => (
  <>
    {Array.from({ length: count || 1 }).map((_, i) => (
      <div key={`provider-skeleton-${i}`} data-testid="provider-skeleton" />
    ))}
  </>
);
export const ProviderSidebarSkeleton = ({ count }: { count?: number }) => (
  <>
    {Array.from({ length: count || 1 }).map((_, i) => (
      <div key={`provider-sidebar-skeleton-${i}`} data-testid="provider-sidebar-skeleton" />
    ))}
  </>
);
export const ModelCardSkeleton = () => <div data-testid="model-card-skeleton" />;

// FloatingCard
export const FloatingCard = forwardRef<
  HTMLDivElement,
  {
    name?: string;
    description?: string;
    icon?: ReactNode;
    children?: ReactNode;
    className?: string;
    delay?: number;
  }
>(({ name, description, icon, children, className, ...props }, ref) => (
  <div ref={ref} data-testid="floating-card" className={className} {...props}>
    {icon}
    {name && <span>{name}</span>}
    {description && <span>{description}</span>}
    {children}
  </div>
));
FloatingCard.displayName = 'FloatingCard';
export type FloatingCardProps = {
  name?: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  delay?: number;
};
