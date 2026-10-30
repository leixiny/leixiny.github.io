import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

export function Button({ variant = 'primary', loading, children, className, ...props }: ButtonProps) {
  return (
    <button
      className={`${buttonStyles[variant]} ${className ?? ''}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? '处理中...' : children}
    </button>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className ?? ''}`}>{children}</section>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'purple' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' | 'info' }) {
  return <div className={`alert alert-${tone}`}>{children}</div>
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◇</div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`input ${props.className ?? ''}`} />
}

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="page-action">{action}</div> : null}
    </div>
  )
}
