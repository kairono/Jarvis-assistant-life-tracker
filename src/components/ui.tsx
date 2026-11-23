import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from './Icon';

// ------------------------------------------------------------------ //
//  Reusable HUD UI primitives.                                        //
// ------------------------------------------------------------------ //

export function Panel({
  children,
  className = '',
  corners = false,
}: {
  children: ReactNode;
  className?: string;
  corners?: boolean;
}) {
  return (
    <div className={`hud-panel ${corners ? 'hud-corners' : ''} ${className}`}>{children}</div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg text-text">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'accent',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: string;
  tone?: 'accent' | 'success' | 'danger' | 'warn';
}) {
  const toneText = {
    accent: 'text-accent',
    success: 'text-success',
    danger: 'text-danger',
    warn: 'text-warn',
  }[tone];
  return (
    <Panel corners className="p-5">
      <div className="flex items-start justify-between">
        <span className="label-tech">{label}</span>
        {icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ${toneText}`}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className={`mt-2 font-display text-2xl ${toneText} text-glow`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Panel>
  );
}

const TONES: Record<string, string> = {
  accent: 'bg-accent/15 text-accent border-accent/30',
  success: 'bg-success/15 text-success border-success/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
  muted: 'bg-muted/10 text-muted border-border',
};

export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: string }) {
  const color = { accent: 'bg-accent', success: 'bg-success', warn: 'bg-warn', danger: 'bg-danger' }[tone] ?? 'bg-accent';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ icon = 'cpu', text }: { icon?: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted">
      <Icon name={icon} size={28} className="opacity-50" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const cls = { primary: 'btn-primary', ghost: 'btn-ghost', danger: 'btn-danger' }[variant];
  return (
    <button className={`${cls} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  size = 18,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; size?: number }) {
  return (
    <button
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-muted transition hover:bg-white/20 hover:text-text active:scale-95 ${className}`}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label-tech mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input-base ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input-base ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input-base ${props.className ?? ''}`} />;
}

// ------------------------------------------------------------------ //
//  Modal                                                              //
// ------------------------------------------------------------------ //
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
      onMouseDown={onClose}
    >
      <div
        className={`hud-panel glass w-full ${wide ? 'max-w-2xl' : 'max-w-md'} animate-fade-in p-6`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg text-text">{title}</h3>
          <IconButton icon="x" onClick={onClose} aria-label="Close" />
        </div>
        <div className="max-h-[70vh] overflow-y-auto pr-1">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
