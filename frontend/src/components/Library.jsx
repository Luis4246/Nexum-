import Icon from './Icon'
import { iniciales } from '../utils/formato'

// C06 · Avatar con iniciales.
export function Avatar({ nombre, size }) {
  // Tamaño base 32 px; el avatar grande de A-09 escala también sus iniciales (componente ×2).
  const estilo = size ? { width: size, height: size, fontSize: size * 13 / 32, lineHeight: 1 } : undefined
  return <span className="nx-avatar" style={estilo} aria-hidden="true">{iniciales(nombre)}</span>
}

// C08 · Document card. La miniatura es la ilustración genérica del diseño: generar una real obligaría
// a descargar cada PDF y dejaría un registro «abrir» en la auditoría.
export function DocumentCard({ nombre, meta, onOpen }) {
  return <button type="button" className="nx-doc-card" onClick={onOpen}>
    <span className="nx-doc-card__thumb" aria-hidden="true">
      <span className="nx-doc-card__page">
        {[56, 88, 80, 88, 64, 88, 72, 88, 40].map((w, i) => <i key={i} style={{ width: w }} />)}
      </span>
    </span>
    <span className="nx-doc-card__info">
      <span className="nx-doc-card__name">{nombre}</span>
      <span className="nx-caption nx-muted">{meta}</span>
    </span>
  </button>
}

// C10 · Pestañas de carpeta con conteo. «Todos» usa la misma pieza.
export function FolderTabs({ carpetas, actual, onChange, total, extra }) {
  return <div className="nx-folder-tabs" role="toolbar" aria-label="Carpetas">
    <button type="button" className="nx-folder-tab" aria-pressed={actual === null} onClick={() => onChange(null)}>
      <Icon name="folder" size={16} />Todos<span className="nx-folder-tab__count">{total}</span>
    </button>
    {carpetas.map(c => <button key={c.id} type="button" className="nx-folder-tab" aria-pressed={actual === c.id} onClick={() => onChange(c.id)}>
      <Icon name="folder" size={16} />{c.nombre}<span className="nx-folder-tab__count">{c.cantidad}</span>
    </button>)}
    {extra}
  </div>
}

export function FolderTag({ nombre }) {
  return <span className="nx-folder-tag"><Icon name="folder" size={14} />{nombre}</span>
}

export function FileTile({ large }) {
  return <span className={'nx-file-tile' + (large ? ' nx-file-tile--lg' : '')} aria-hidden="true"><Icon name="file-text" size={18} /></span>
}
