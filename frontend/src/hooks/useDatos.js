import { useCallback, useEffect, useState } from 'react'
import { mensaje } from '../api'

// Carga datos de la API y expone el estado de carga, el error y una función para recargar.
export default function useDatos(cargar, dependencias = []) {
  const [estado, setEstado] = useState({ datos: null, error: '', cargando: true })
  const recargar = useCallback(async () => {
    try { const datos = await cargar(); setEstado({ datos, error: '', cargando: false }); return datos }
    catch (e) { setEstado(s => ({ ...s, error: mensaje(e), cargando: false })) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias)
  useEffect(() => { recargar() }, [recargar])
  return { ...estado, recargar }
}
