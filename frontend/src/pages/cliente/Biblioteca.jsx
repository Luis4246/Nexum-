import { useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { EmptyState, InlineAlert, Spinner } from '../../components/Feedback'
import { SearchField } from '../../components/Field'
import { DocumentCard, FolderTabs } from '../../components/Library'
import useDatos from '../../hooks/useDatos'
import { navigate } from '../../router'
import { miBiblioteca } from '../../services/biblioteca'
import { fecha, plural } from '../../utils/formato'

// C-11 · Biblioteca del cliente. Solo trae los documentos asignados a su cuenta (lo valida el backend).
// Las carpetas usan las mismas pestañas de A-10 y muestran solo las que tienen documentos del cliente.
export default function Biblioteca() {
  const { datos, error } = useDatos(miBiblioteca)
  const [carpeta, setCarpeta] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [bienvenida, setBienvenida] = useState(() => !sessionStorage.getItem('nx-bienvenida'))
  const carpetas = useMemo(() => {
    const mapa = new Map()
    for (const d of datos || []) if (d.carpeta) mapa.set(d.carpeta.id, { ...d.carpeta, cantidad: (mapa.get(d.carpeta.id)?.cantidad || 0) + 1 })
    return [...mapa.values()].sort((a, b) => a.id - b.id)
  }, [datos])
  if (!datos) return error ? <div className="nx-page"><InlineAlert type="error">{error}</InlineAlert></div> : <Spinner />
  const visibles = datos.filter(d => (carpeta === null || d.carpeta?.id === carpeta) && d.titulo.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => (b.asignado_en || '').localeCompare(a.asignado_en || ''))
  const cerrarBienvenida = () => { sessionStorage.setItem('nx-bienvenida', '1'); setBienvenida(false) }

  return <main className="nx-page">
    <div className="nx-page__top">
      <div className="nx-page__title"><h1 className="nx-h1">Mis documentos</h1>
        <p className="nx-body nx-muted">{datos.length ? `Tienes ${plural(datos.length, 'documento disponible', 'documentos disponibles')} para revisar y anotar.` : 'Todavía no tienes documentos asignados.'}</p></div>
      {datos.length > 0 && <div className="nx-page__tools"><SearchField label="Buscar por nombre" placeholder="Buscar por nombre" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></div>}
    </div>
    {bienvenida && <div className="nx-auth__row nx-alert nx-alert--success" role="status">
      <span className="nx-body-sm">Tu cuenta está activa. Ya puedes abrir, revisar y anotar los documentos que te asignó tu administrador.</span>
      <Button variant="text" size="sm" onClick={cerrarBienvenida}>Entendido</Button></div>}
    {carpetas.length > 0 && <FolderTabs carpetas={carpetas} actual={carpeta} onChange={setCarpeta} total={datos.length} />}
    {visibles.length ? <>
      <p className="nx-caption nx-muted">{plural(visibles.length, 'documento', 'documentos')} · ordenados por fecha de asignación</p>
      <div className="nx-grid-cards">{visibles.map(d => <DocumentCard key={d.id} nombre={d.titulo}
        meta={[d.asignado_en && 'Asignado el ' + fecha(d.asignado_en), plural(d.paginas, 'página', 'páginas')].filter(Boolean).join(' · ')}
        onOpen={() => navigate('/biblioteca/' + d.id)} />)}</div></>
      : <div className="nx-card">{busqueda ? <EmptyState icon="search" title={`No encontramos «${busqueda}»`}
        action={<Button variant="secondary" onClick={() => setBusqueda('')}>Limpiar búsqueda</Button>}>Revisa la ortografía o prueba con otra palabra del nombre del documento.</EmptyState>
        : <EmptyState title="Sin documentos asignados">Cuando tu administrador te asigne documentos, aparecerán aquí.</EmptyState>}</div>}
  </main>
}
