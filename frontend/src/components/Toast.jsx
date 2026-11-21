import { createContext, useCallback, useContext, useState } from 'react'
import Icon from './Icon'
import { IconButton } from './Button'

// C05 · Toast. Éxito e información se cierran a los 5 s; los errores quedan hasta cerrarlos.
const Contexto = createContext(() => {})
const ICONOS = { success: 'circle-check', error: 'circle-alert', info: 'info' }

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([])
  const cerrar = useCallback(id => setAvisos(a => a.filter(x => x.id !== id)), [])
  const avisar = useCallback((titulo, mensaje = '', tipo = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setAvisos(a => [...a, { id, titulo, mensaje, tipo }])
    if (tipo !== 'error') setTimeout(() => cerrar(id), 5000)
  }, [cerrar])
  return <Contexto.Provider value={avisar}>
    {children}
    <div className="nx-toasts" aria-live="polite">
      {avisos.map(a => <div key={a.id} className={'nx-toast nx-toast--' + a.tipo} role={a.tipo === 'error' ? 'alert' : 'status'}>
        <Icon name={ICONOS[a.tipo]} size={20} />
        <div className="nx-toast__text"><strong className="nx-label">{a.titulo}</strong>
          {a.mensaje && <span className="nx-caption nx-muted">{a.mensaje}</span>}</div>
        <IconButton icon="x" label="Cerrar aviso" size="sm" tooltip={false} onClick={() => cerrar(a.id)} />
      </div>)}
    </div>
  </Contexto.Provider>
}

export const useToast = () => useContext(Contexto)
