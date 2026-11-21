import Icon from './Icon'

// C02 · Button: Variant (primary, secondary, text, danger) × Size (md, sm), con ícono y estado de carga.
export function Button({ variant = 'primary', size = 'md', icon, loading = false, block = false, children, className = '', type = 'button', ...props }) {
  const clases = ['nx-btn', `nx-btn--${variant}`, size === 'sm' && 'nx-btn--sm', block && 'nx-btn--block', className].filter(Boolean).join(' ')
  return <button type={type} className={clases} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
    {loading ? <span className="nx-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} />}
    {children}
  </button>
}

// C02 · Icon button: siempre con nombre accesible y tooltip. «pressed» es el estado Active de las herramientas.
export function IconButton({ icon, label, size = 'md', tone, pressed, tooltip = true, className = '', ...props }) {
  const clases = ['nx-icon-btn', size === 'sm' && 'nx-icon-btn--sm', tone && `nx-icon-btn--${tone}`, className].filter(Boolean).join(' ')
  const boton = <button type="button" className={clases} aria-label={label} aria-pressed={pressed} {...props}>
    <Icon name={icon} size={size === 'sm' ? 16 : 20} />
  </button>
  if (!tooltip) return boton
  return <span className="nx-tip">{boton}<span className="nx-tip__label" aria-hidden="true">{label}</span></span>
}
