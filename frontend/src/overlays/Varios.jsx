import { useState } from 'react'
import { mensaje } from '../api'
import { Button } from '../components/Button'
import { InlineAlert } from '../components/Feedback'
import { TextField } from '../components/Field'
import { Modal } from '../components/Overlay'
import { crearCarpeta, renombrarCarpeta } from '../services/documentos'
import { crearCuentasEnLote } from '../services/cuentas'

// A-10 · Nueva carpeta (overlay). También sirve para renombrar una carpeta existente.
export function CarpetaForm({ carpeta, onClose, onGuardada }) {
  const [nombre, setNombre] = useState(carpeta?.nombre || '')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function guardar(e) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Escribe un nombre para la carpeta.')
    setOcupado(true)
    try { onGuardada(carpeta ? await renombrarCarpeta(carpeta.id, nombre.trim()) : await crearCarpeta(nombre.trim())) }
    catch (err) { setError(mensaje(err)); setOcupado(false) }
  }
  return <Modal as="form" onSubmit={guardar} size="sm" title={carpeta ? 'Renombrar carpeta' : 'Nueva carpeta'} onClose={ocupado ? undefined : onClose}
    footer={<><Button variant="text" onClick={onClose} disabled={ocupado}>Cancelar</Button>
      <Button type="submit" icon={carpeta ? undefined : 'folder-plus'} loading={ocupado}>{carpeta ? 'Guardar nombre' : 'Crear carpeta'}</Button></>}>
    <TextField label="Nombre de la carpeta" placeholder="Por ejemplo, Capacitaciones" autoFocus value={nombre} onChange={e => { setNombre(e.target.value); setError('') }}
      error={error} help="Podrás mover documentos a esta carpeta al editarlos o al subirlos." />
  </Modal>
}

// Contraseñas generadas por el backend: se muestran una sola vez para entregarlas al cliente.
export function Credenciales({ titulo = 'Contraseña generada', credenciales, onClose }) {
  const [copiado, setCopiado] = useState(false)
  const texto = credenciales.map(c => `${c.codigo}\t${c.clave}`).join('\n')
  return <Modal size="sm" title={titulo} onClose={onClose} footer={<>
    <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(texto); setCopiado(true) } catch { setCopiado(false) } }}>{copiado ? 'Copiado' : 'Copiar'}</Button>
    <Button onClick={onClose}>Listo</Button></>}>
    <InlineAlert type="warning">Guarda {credenciales.length > 1 ? 'estas contraseñas' : 'esta contraseña'} antes de cerrar: no se volverá a mostrar.</InlineAlert>
    <dl className="nx-credenciales">{credenciales.map(c => <div key={c.codigo}><dt className="nx-label">{c.codigo}</dt><dd className="nx-label" style={{ fontFamily: 'monospace' }}>{c.clave}</dd></div>)}</dl>
  </Modal>
}

// Función existente del backend: crear varias cuentas con código automático (cliente001, cliente002…).
export function CrearLote({ onClose, onCreadas }) {
  const [cantidad, setCantidad] = useState('1')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  async function crear(e) {
    e.preventDefault()
    const n = Number(cantidad)
    if (!Number.isInteger(n) || n < 1 || n > 500) return setError('Indica un número entre 1 y 500.')
    setOcupado(true)
    try { onCreadas(await crearCuentasEnLote(n)) } catch (err) { setError(mensaje(err)); setOcupado(false) }
  }
  return <Modal as="form" onSubmit={crear} size="sm" title="Crear cuentas en lote" onClose={ocupado ? undefined : onClose}
    footer={<><Button variant="text" onClick={onClose} disabled={ocupado}>Cancelar</Button><Button type="submit" loading={ocupado}>Crear cuentas</Button></>}>
    <p className="nx-body-sm nx-muted">Cada cuenta recibe un usuario automático (por ejemplo, cliente003) y una contraseña al azar. Quedan pendientes de autorización hasta que las habilites.</p>
    <TextField label="Número de cuentas" type="number" min="1" max="500" value={cantidad} onChange={e => { setCantidad(e.target.value); setError('') }} error={error} autoFocus />
  </Modal>
}
