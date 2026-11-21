import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'

// C05 · Menú desplegable de acciones. «items» admite { label, icon, onSelect, danger } o 'divider'.
export function Menu({ trigger, items, label = 'Acciones' }) {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = e => { if (!ancla.current?.contains(e.target)) setAbierto(false) }
    const tecla = e => { if (e.key === 'Escape') { setAbierto(false); ancla.current?.querySelector('button')?.focus() } }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    ancla.current?.querySelector('[role="menuitem"]')?.focus()
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla) }
  }, [abierto])
  const mover = e => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return
    e.preventDefault()
    const opciones = [...ancla.current.querySelectorAll('[role="menuitem"]')]
    const i = opciones.indexOf(document.activeElement)
    opciones[(i + (e.key === 'ArrowDown' ? 1 : -1) + opciones.length) % opciones.length]?.focus()
  }
  return <span className="nx-menu-anchor" ref={ancla}>
    {trigger({ 'aria-haspopup': 'menu', 'aria-expanded': abierto, onClick: () => setAbierto(a => !a) })}
    {abierto && <div className="nx-menu" role="menu" aria-label={label} onKeyDown={mover}>
      {items.filter(Boolean).map((item, i) => item === 'divider'
        ? <div key={i} className="nx-menu__divider" role="separator" />
        : <button key={i} type="button" role="menuitem" className={'nx-menu__item' + (item.danger ? ' nx-menu__item--danger' : '')}
          onClick={() => { setAbierto(false); item.onSelect() }}>
          {item.icon && <Icon name={item.icon} size={16} />}{item.label}
        </button>)}
    </div>}
  </span>
}
