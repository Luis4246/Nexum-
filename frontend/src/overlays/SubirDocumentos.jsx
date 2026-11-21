import { useMemo, useState } from 'react'
import { mensaje } from '../api'
import Icon from '../components/Icon'
import { Button } from '../components/Button'
import { Dropzone, PickerRow, UploadItem } from '../components/Carga'
import { InlineAlert } from '../components/Feedback'
import { SearchField, SelectField } from '../components/Field'
import { Avatar } from '../components/Library'
import { Modal } from '../components/Overlay'
import { asignar, subirDocumento } from '../services/documentos'
import { nombreCuenta, plural } from '../utils/formato'

// A-06 · Subir documentos (overlay). Estados: archivos seleccionados, subiendo, carga exitosa y error en un archivo.
// Cada archivo se sube por separado para mostrar su avance y su error real.
export default function SubirDocumentos({ iniciales = [], carpetas, cuentas, maxMb, carpetaInicial = '', onClose, onListo }) {
  const [items, setItems] = useState(() => preparar(iniciales, maxMb))
  const [carpeta, setCarpeta] = useState(carpetaInicial ? String(carpetaInicial) : '')
  const [elegidos, setElegidos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [fase, setFase] = useState('seleccion')
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState(null)

  const pendientes = items.filter(i => i.estado === 'espera')
  const visibles = useMemo(() => cuentas.filter(c => (nombreCuenta(c) + ' ' + c.correo + ' ' + c.codigo)
    .toLowerCase().includes(busqueda.toLowerCase())), [cuentas, busqueda])

  function agregar(archivos) { setItems(a => [...a, ...preparar(archivos, maxMb)]); setError('') }
  const actualizar = (clave, cambios) => setItems(a => a.map(i => i.clave === clave ? { ...i, ...cambios } : i))

  async function subir() {
    setFase('subiendo'); setError('')
    const subidos = items.filter(i => i.estado === 'listo').map(i => i.doc)
    let fallidos = 0
    for (const item of pendientes) {
      actualizar(item.clave, { estado: 'subiendo', progreso: 0 })
      try {
        const doc = await subirDocumento(item.archivo, { carpeta, alAvanzar: p => actualizar(item.clave, { progreso: p }) })
        actualizar(item.clave, { estado: 'listo', doc }); subidos.push(doc)
      } catch (e) { fallidos++; actualizar(item.clave, { estado: 'error', error: mensaje(e) }) }
    }
    try { if (subidos.length && elegidos.length) await asignar(elegidos, subidos.map(d => d.id)) }
    catch (e) { setError('Los documentos se subieron, pero no se pudieron asignar: ' + mensaje(e)); setFase('seleccion'); return }
    if (fallidos) { setError(`${plural(fallidos, 'archivo no se pudo subir', 'archivos no se pudieron subir')}. Revisa el motivo en cada uno.`); setFase('seleccion'); return }
    setResultado({ cantidad: subidos.length, carpeta: carpetas.find(c => String(c.id) === carpeta)?.nombre, clientes: elegidos.map(id => nombreCuenta(cuentas.find(c => c.id === id))) })
    setFase('listo')
  }

  if (fase === 'listo') return <Modal title="Documentos subidos" onClose={() => onListo()} size="sm" footer={<>
    <Button variant="secondary" onClick={() => { setItems([]); setElegidos([]); setResultado(null); setFase('seleccion') }}>Subir más documentos</Button>
    <Button onClick={() => onListo()}>Listo</Button></>}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '8px 0' }}>
      <span className="nx-auth__icon" style={{ background: 'var(--nx-status-success-bg)', color: 'var(--nx-status-success)' }}><Icon name="circle-check" size={24} /></span>
      <p className="nx-h3">{plural(resultado.cantidad, 'documento subido', 'documentos subidos')}{resultado.carpeta ? ` a «${resultado.carpeta}»` : ''}</p>
      <p className="nx-body-sm nx-muted">{resultado.clientes.length ? `Ya están disponibles para ${lista(resultado.clientes)}.` : 'Todavía no están asignados a ningún cliente.'}</p>
    </div>
  </Modal>

  const subiendo = fase === 'subiendo'
  return <Modal title="Subir documentos" onClose={subiendo ? undefined : onClose} closeOnBackdrop={!subiendo} size="lg"
    footerInfo={subiendo ? 'No cierres esta ventana hasta que termine la carga.' : `${plural(pendientes.length, 'archivo', 'archivos')} · ${plural(elegidos.length, 'cliente', 'clientes')}`}
    footer={<><Button variant="text" onClick={onClose} disabled={subiendo}>Cancelar</Button>
      <Button icon="upload" loading={subiendo} disabled={!pendientes.length} onClick={subir}>{subiendo ? 'Subiendo…' : `Subir ${plural(pendientes.length, 'archivo', 'archivos')}`}</Button></>}>
    {error && <InlineAlert type="error">{error}</InlineAlert>}
    {!subiendo && <Dropzone compact maxMb={maxMb} onFiles={agregar} />}
    {items.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(i => <UploadItem key={i.clave} archivo={i.archivo} estado={i.estado} progreso={i.progreso} error={i.error}
        onQuitar={() => setItems(a => a.filter(x => x.clave !== i.clave))} />)}</div>}
    <SelectField label="Carpeta" icon="folder" value={carpeta} onChange={e => setCarpeta(e.target.value)} disabled={subiendo}>
      <option value="">Sin carpeta</option>{carpetas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
    </SelectField>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div><p className="nx-label">Asignar a clientes</p><p className="nx-caption nx-muted">Solo los clientes seleccionados verán estos documentos.</p></div>
      <SearchField label="Buscar clientes" placeholder="Buscar clientes" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      <div className="nx-picker">{visibles.map(c => <PickerRow key={c.id} titulo={nombreCuenta(c)} detalle={c.correo || c.codigo}
        inicio={<Avatar nombre={nombreCuenta(c)} />} seleccionado={elegidos.includes(c.id)}
        onChange={v => setElegidos(e => v ? [...e, c.id] : e.filter(x => x !== c.id))} />)}
        {!visibles.length && <p className="nx-body-sm nx-muted" style={{ padding: 12 }}>{cuentas.length ? 'Ningún cliente coincide con la búsqueda.' : 'Aún no hay clientes. Puedes asignar los documentos más tarde.'}</p>}</div>
    </div>
  </Modal>
}

function preparar(archivos, maxMb) {
  return archivos.map(archivo => {
    const pdf = archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf')
    const grande = maxMb && archivo.size > maxMb * 1024 * 1024
    const error = !pdf ? 'No es un archivo PDF' : grande ? `Supera el límite de ${maxMb} MB` : ''
    return { clave: Math.random().toString(36).slice(2), archivo, estado: error ? 'error' : 'espera', progreso: 0, error }
  })
}

const lista = nombres => nombres.length < 2 ? nombres.join('') : nombres.slice(0, -1).join(', ') + ' y ' + nombres.at(-1)
