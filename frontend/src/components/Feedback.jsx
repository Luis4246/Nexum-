import Icon from './Icon'

// C04 · Status tag. Los textos siguen el diseño («Activa») y los estados definitivos de NEXUM.
export const ESTADOS = {
  habilitada: 'Activa',
  pendiente: 'Pendiente',
  suspendida: 'Suspendida',
  deshabilitada: 'Deshabilitada',
}

export function StatusTag({ estado }) {
  return <span className={'nx-tag nx-tag--' + estado}>{ESTADOS[estado] || estado}</span>
}

// C09 · Inline alert: Error, Warning, Success (e Info para avisos neutros).
const ICONO_ALERTA = { error: 'circle-alert', warning: 'lock', success: 'circle-check', info: 'info' }

export function InlineAlert({ type = 'info', icon, children, role }) {
  return <div className={'nx-alert nx-alert--' + type} role={role || (type === 'error' ? 'alert' : 'status')}>
    <Icon name={icon || ICONO_ALERTA[type]} size={20} /><div>{children}</div>
  </div>
}

// C08 · Empty state: título, texto y acción opcional.
export function EmptyState({ icon = 'file-text', title, children, action }) {
  return <div className="nx-empty">
    <span className="nx-empty__icon"><Icon name={icon} size={24} /></span>
    <h2 className="nx-h3">{title}</h2>
    {children && <p className="nx-body-sm nx-muted">{children}</p>}
    {action}
  </div>
}

export function Spinner({ label = 'Cargando…' }) {
  return <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 0', justifyContent: 'center' }}
    className="nx-body-sm nx-muted"><span className="nx-spinner" style={{ width: 16, height: 16, color: 'var(--nx-brand-violet)' }} />{label}</div>
}
