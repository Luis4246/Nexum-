import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from './Button'

const ENFOCABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// C05/C11 · Overlay base. Se abre sobre la pantalla actual con el fondo azul noche al 40 %,
// retiene el foco, se cierra con Esc o con clic fuera, y devuelve el foco a quien lo abrió.
export function Overlay({ onClose, labelledBy, children, closeOnBackdrop = true }) {
  const fondo = useRef(null)
  const anterior = useRef(document.activeElement)
  const cerrar = useRef(onClose)
  cerrar.current = onClose
  useEffect(() => {
    const foco = anterior.current
    const primero = fondo.current?.querySelector('[autofocus]') || fondo.current?.querySelector(ENFOCABLES)
    primero?.focus()
    const tecla = e => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrar.current?.() }
      if (e.key !== 'Tab' || !fondo.current) return
      const items = [...fondo.current.querySelectorAll(ENFOCABLES)]
      if (!items.length) return
      const [inicio, fin] = [items[0], items.at(-1)]
      if (e.shiftKey && document.activeElement === inicio) { e.preventDefault(); fin.focus() }
      else if (!e.shiftKey && document.activeElement === fin) { e.preventDefault(); inicio.focus() }
    }
    document.addEventListener('keydown', tecla)
    const desplazamiento = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = desplazamiento; foco?.focus?.() }
  }, [])
  return createPortal(<div ref={fondo} className="nx-overlay" role="dialog" aria-modal="true" aria-labelledby={labelledBy}
    onMouseDown={e => { if (closeOnBackdrop && e.target === fondo.current) onClose?.() }}>{children}</div>, document.body)
}

// Estructura de modal de Figma: título que nombra la acción, cierre, contenido y botones a la derecha.
export function Modal({ title, onClose, size = 'md', children, footer, footerInfo, as: Tag = 'div', onSubmit, closeOnBackdrop }) {
  const id = useId()
  const clase = 'nx-modal' + (size === 'sm' ? ' nx-modal--sm' : size === 'lg' ? ' nx-modal--md' : '')
  return <Overlay onClose={onClose} labelledBy={id} closeOnBackdrop={closeOnBackdrop}>
    <Tag className={clase} onSubmit={onSubmit} noValidate={Tag === 'form' ? true : undefined}>
      <div className="nx-modal__head">
        <h2 id={id} className="nx-h3">{title}</h2>
        {onClose && <IconButton icon="x" label="Cerrar" size="sm" tooltip={false} onClick={onClose} />}
      </div>
      <div className="nx-modal__body">{children}</div>
      {footer && <div className="nx-modal__foot">{footerInfo && <span className="nx-modal__foot-info nx-caption nx-muted">{footerInfo}</span>}{footer}</div>}
    </Tag>
  </Overlay>
}
