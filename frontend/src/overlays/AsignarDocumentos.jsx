import { useMemo, useState } from 'react'
import { mensaje } from '../api'
import { Button } from '../components/Button'
import { PickerRow } from '../components/Carga'
import { InlineAlert } from '../components/Feedback'
import { SearchField } from '../components/Field'
import { FileTile, FolderTabs } from '../components/Library'
import { Modal } from '../components/Overlay'
import { asignar, quitarAsignacion } from '../services/documentos'
import { nombreCuenta, plural, tamano } from '../utils/formato'

// A-09 · Asignar documentos a un cliente (overlay). Marca y desmarca; los cambios se aplican al guardar.
export default function AsignarDocumentos({ cuenta, documentos, carpetas, onClose, onGuardado }) {
  const asignados = useMemo(() => documentos.filter(d => d.cuentas.includes(cuenta.id)).map(d => d.id), [documentos, cuenta.id])
  const [marcados, setMarcados] = useState(asignados)
  const [carpeta, setCarpeta] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const nuevos = marcados.filter(id => !asignados.includes(id))
  const quitados = asignados.filter(id => !marcados.includes(id))
  const visibles = documentos.filter(d => (carpeta === null || d.carpeta?.id === carpeta) && d.titulo.toLowerCase().includes(busqueda.toLowerCase()))
  const conteo = carpetas.map(c => ({ ...c, cantidad: documentos.filter(d => d.carpeta?.id === c.id).length }))

  async function guardar() {
    setOcupado(true); setError('')
    try {
      if (nuevos.length) await asignar([cuenta.id], nuevos)
      if (quitados.length) await quitarAsignacion([cuenta.id], quitados)
      onGuardado({ nuevos: nuevos.length, quitados: quitados.length })
    } catch (e) { setError(mensaje(e)); setOcupado(false) }
  }

  const resumen = [nuevos.length && plural(nuevos.length, 'documento nuevo', 'documentos nuevos'), quitados.length && plural(quitados.length, 'documento quitado', 'documentos quitados'),
    plural(asignados.length - quitados.length, 'ya asignado', 'ya asignados')].filter(Boolean).join(' · ')
  return <Modal title={'Asignar documentos a ' + nombreCuenta(cuenta)} onClose={ocupado ? undefined : onClose} size="lg" footerInfo={resumen}
    footer={<><Button variant="text" onClick={onClose} disabled={ocupado}>Cancelar</Button>
      <Button loading={ocupado} disabled={!nuevos.length && !quitados.length} onClick={guardar}>Guardar asignación</Button></>}>
    <p className="nx-body-sm nx-muted">Los documentos marcados quedan disponibles en su biblioteca. Si quitas uno, sus anotaciones se conservan por si vuelves a asignarlo.</p>
    {error && <InlineAlert type="error">{error}</InlineAlert>}
    <SearchField label="Buscar documentos" placeholder="Buscar documentos" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
    {carpetas.length > 0 && <FolderTabs carpetas={conteo} actual={carpeta} onChange={setCarpeta} total={documentos.length} />}
    <div className="nx-picker">{visibles.map(d => <PickerRow key={d.id} titulo={d.titulo} inicio={<FileTile />}
      detalle={[d.carpeta?.nombre, asignados.includes(d.id) ? 'ya asignado' : tamano(d.tamano)].filter(Boolean).join(' · ')}
      seleccionado={marcados.includes(d.id)} onChange={v => setMarcados(m => v ? [...m, d.id] : m.filter(x => x !== d.id))} />)}
      {!visibles.length && <p className="nx-body-sm nx-muted" style={{ padding: 12 }}>{documentos.length ? 'Ningún documento coincide.' : 'Aún no hay documentos cargados.'}</p>}</div>
  </Modal>
}
