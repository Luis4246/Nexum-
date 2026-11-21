import { useState } from 'react'
import { mensaje } from '../api'
import { Button } from '../components/Button'
import { InlineAlert } from '../components/Feedback'
import { Modal } from '../components/Overlay'

// C05 · Modal Confirm / Danger: título que nombra la acción y botón principal a la derecha.
export default function Confirmar({ titulo, children, confirmar, variante = 'danger', onConfirm, onClose }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  async function aceptar() {
    setOcupado(true); setError('')
    try { await onConfirm() } catch (e) { setError(mensaje(e)); setOcupado(false) }
  }
  return <Modal title={titulo} onClose={ocupado ? undefined : onClose} size="sm" footer={<>
    <Button variant="text" onClick={onClose} disabled={ocupado}>Cancelar</Button>
    <Button variant={variante} loading={ocupado} onClick={aceptar}>{confirmar}</Button>
  </>}>
    <p className="nx-body-sm nx-muted">{children}</p>
    {error && <InlineAlert type="error">{error}</InlineAlert>}
  </Modal>
}
