import { useId, useState } from 'react'
import Icon from './Icon'

// C03 · Input: Type (default, icon, password) × State (default, focus, error, disabled).
// El error siempre se explica en texto, no solo con color.
export function Field({ label, error, help, icon, children, disabled, id, hideLabel = false }) {
  const generado = useId()
  const campo = id || generado
  const clases = ['nx-field', error && 'nx-field--error', disabled && 'nx-field--disabled'].filter(Boolean).join(' ')
  return <div className={clases}>
    {label && <label htmlFor={campo} className={hideLabel ? 'nx-sr-only' : 'nx-field__label'}>{label}</label>}
    <div className="nx-field__control">
      {icon && <Icon name={icon} size={20} />}
      {children(campo, error ? campo + '-ayuda' : help ? campo + '-ayuda' : undefined)}
    </div>
    {(error || help) && <div className="nx-field__help" id={campo + '-ayuda'}>
      {error && <Icon name="circle-alert" size={16} />}<span>{error || help}</span>
    </div>}
  </div>
}

export function TextField({ label, error, help, icon, hideLabel, disabled, ...props }) {
  return <Field label={label} error={error} help={help} icon={icon} hideLabel={hideLabel} disabled={disabled} id={props.id}>
    {(id, ayuda) => <input id={id} disabled={disabled} aria-invalid={!!error || undefined} aria-describedby={ayuda} {...props} />}
  </Field>
}

export function SearchField({ label = 'Buscar', ...props }) {
  return <TextField label={label} hideLabel icon="search" type="search" {...props} />
}

export function PasswordField({ label = 'Contraseña', error, help, disabled, ...props }) {
  const [visible, setVisible] = useState(false)
  return <Field label={label} error={error} help={help} disabled={disabled} id={props.id}>
    {(id, ayuda) => <>
      <input id={id} type={visible ? 'text' : 'password'} disabled={disabled} aria-invalid={!!error || undefined}
        aria-describedby={ayuda} {...props} />
      <button type="button" className="nx-field__toggle" onClick={() => setVisible(v => !v)} disabled={disabled}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
      </button>
    </>}
  </Field>
}

export function SelectField({ label, error, help, icon, disabled, hideLabel, children, ...props }) {
  return <Field label={label} error={error} help={help} icon={icon} disabled={disabled} hideLabel={hideLabel} id={props.id}>
    {(id, ayuda) => <select id={id} disabled={disabled} aria-describedby={ayuda} {...props}>{children}</select>}
  </Field>
}
