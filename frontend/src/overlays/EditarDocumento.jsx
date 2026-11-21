import { useMemo, useRef, useState } from 'react'
import { mensaje } from '../api'
import { Button } from '../components/Button'
import { PickerRow, UploadItem } from '../components/Carga'
import { InlineAlert } from '../components/Feedback'
import { SelectField, TextField } from '../components/Field'
import { Avatar } from '../components/Library'
import { Modal } from '../components/Overlay'
import { asignar, editarDocumento, quitarAsignacion, reemplazarDocumento } from '../services/documentos'
import { fecha, nombreCuenta, plural } from '../utils/formato'

// A-10 · Editar documento (overlay): nombre, carpeta y clientes asignados. Incluye las versiones:
// subir una nueva conserva la anterior con sus anotaciones, y la nueva empieza sin anotaciones.
export default function EditarDocumento({ documento, carpetas, cuentas, maxMb, onClose, onGuardado }) {
  const [form, setForm] = useState({ titulo: documento.titulo, carpeta: documento.carpeta ? String(documento.carpeta.id) : '' })
  const [marcados, setMarcados] = useState(documento.cuentas)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [version, setVersion] = useState(null)
  const entrada = useRef(null)
  const nuevos = marcados.filter(id => !documento.cuentas.includes(id))
  const quitados = documento.cuentas.filter(id => !marcados.includes(id))
  const ordenadas = useMemo(() => [...cuentas].sort((a, b) => (documento.cuentas.includes(b.id) - documento.cuentas.includes(a.id))), [cuentas, documento.cuentas])

  async function guardar(e) {
    e.preventDefault()
    if (!form.titulo.trim()) return setError('El nombre no puede quedar vacío.')
    setOcupado(true); setError('')
    try {
      const cambios = {}
      if (form.titulo.trim() !== documento.titulo) cambios.titulo = form.titulo.trim()
      if (form.carpeta !== (documento.carpeta ? String(documento.carpeta.id) : '')) cambios.carpeta = form.carpeta ? Number(form.carpeta) : null
      if (Object.keys(cambios).length) await editarDocumento(documento.id, cambios)
      if (nuevos.length) await asignar(nuevos, [documento.id])
      if (quitados.length) await quitarAsignacion(quitados, [documento.id])
      onGuardado()
    } catch (err) { setError(mensaje(err)); setOcupado(false) }
  }

  async function subirVersion(archivo) {
    if (maxMb && archivo.size > maxMb * 1024 * 1024) return setVersion({ archivo, estado: 'error', error: `Supera el límite de ${maxMb} MB` })
    setVersion({ archivo, estado: 'subiendo', progreso: 0 })
    try {
      await reemplazarDocumento(documento.id, archivo, p => setVersion(v => ({ ...v, progreso: p })))
      setVersion({ archivo, estado: 'listo' })
      onGuardado({ cerrar: false })
    } catch (err) { setVersion({ archivo, estado: 'error', error: mensaje(err) }) }
  }

  const ocupadoTotal = ocupado || version?.estado === 'subiendo'
  return <Modal as="form" onSubmit={guardar} title="Editar documento" onClose={ocupadoTotal ? undefined : onClose} size="lg"
    footerInfo={plural(marcados.length, 'cliente asignado', 'clientes asignados')}
    footer={<><Button variant="text" onClick={onClose} disabled={ocupadoTotal}>Cancelar</Button><Button type="submit" loading={ocupado} disabled={ocupadoTotal}>Guardar cambios</Button></>}>
    {error && <InlineAlert type="error">{error}</InlineAlert>}
    <TextField label="Nombre del documento" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} autoFocus />
    <SelectField label="Carpeta" icon="folder" value={form.carpeta} onChange={e => setForm(f => ({ ...f, carpeta: e.target.value }))}>
      <option value="">Sin carpeta</option>{carpetas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
    </SelectField>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div><p className="nx-label">Asignado a</p><p className="nx-caption nx-muted">Quita o agrega clientes. Los cambios se aplican al guardar.</p></div>
      <div className="nx-picker">{ordenadas.map(c => <PickerRow key={c.id} titulo={nombreCuenta(c)} detalle={c.correo || c.codigo} inicio={<Avatar nombre={nombreCuenta(c)} />}
        seleccionado={marcados.includes(c.id)} onChange={v => setMarcados(m => v ? [...m, c.id] : m.filter(x => x !== c.id))} />)}
        {!cuentas.length && <p className="nx-body-sm nx-muted" style={{ padding: 12 }}>Aún no hay clientes.</p>}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="nx-auth__row"><div className="nx-section-title"><p className="nx-label">Versiones</p>
        <p className="nx-caption nx-muted">Vigente: versión {documento.version} · {documento.paginas} páginas. Las anteriores se conservan con las anotaciones de los clientes.</p></div>
        <Button variant="secondary" size="sm" icon="upload" disabled={ocupadoTotal} onClick={() => entrada.current.click()}>Subir nueva versión</Button></div>
      {version && <UploadItem archivo={version.archivo} estado={version.estado} progreso={version.progreso} error={version.error} />}
      <ul className="nx-caption nx-muted" style={{ margin: 0, paddingLeft: 18 }}>{documento.versiones.map(v =>
        <li key={v.numero}>Versión {v.numero}{v.numero === documento.version ? ' (vigente)' : ''} · {v.original} · {fecha(v.creado_en)}</li>)}</ul>
      <input ref={entrada} type="file" accept="application/pdf,.pdf" hidden onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) subirVersion(f) }} />
    </div>
  </Modal>
}
