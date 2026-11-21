import Icon from './Icon'

// C03 · Checkbox. El componente de Figma también tiene estado indeterminado.
export function Checkbox({ label, checked, onChange, disabled, hideLabel = false, indeterminate = false, ...props }) {
  return <label className={'nx-check' + (disabled ? ' nx-check--disabled' : '')}>
    <input type="checkbox" checked={checked} onChange={e => onChange?.(e.target.checked)} disabled={disabled}
      ref={el => { if (el) el.indeterminate = indeterminate }} {...props} />
    <span className="nx-check__box" aria-hidden="true">
      {indeterminate ? <i style={{ width: 8, height: 2, borderRadius: 1, background: 'currentColor' }} /> : checked && <Icon name="check" size={14} />}
    </span>
    <span className={hideLabel ? 'nx-sr-only' : undefined}>{label}</span>
  </label>
}

// C03 · Toggle: para estados que se aplican al instante.
export function Toggle({ label, checked, onChange, disabled, ...props }) {
  return <label className="nx-toggle">
    <input type="checkbox" role="switch" checked={checked} onChange={e => onChange?.(e.target.checked)} disabled={disabled} {...props} />
    <span className="nx-toggle__track" aria-hidden="true" />
    <span>{label}</span>
  </label>
}
