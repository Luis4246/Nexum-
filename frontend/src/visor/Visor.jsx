import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'pdfjs-dist/web/pdf_viewer.css'
import '../styles/visor.css'
import { mensaje } from '../api'
import Icon from '../components/Icon'
import { Button, IconButton } from '../components/Button'
import { EmptyState, InlineAlert, Spinner } from '../components/Feedback'
import { Menu } from '../components/Menu'
import { Modal } from '../components/Overlay'
import { navigate } from '../router'
import { anotaciones as leerAnotaciones, contenido, guardarAnotaciones, miBiblioteca } from '../services/biblioteca'
import { fecha, plural } from '../utils/formato'
import Pagina from './Pagina'
import Temario from './Temario'

GlobalWorkerOptions.workerSrc = worker

// Barra del diseño (C07) sin la herramienta de comentarios, descartada en los requisitos.
const HERRAMIENTAS = [['seleccion', 'mouse-pointer-2', 'Seleccionar (V)'], ['dibujo', 'brush', 'Dibujo libre (B)'], ['lapiz', 'pencil', 'Lápiz (P)'],
  ['resaltado', 'highlighter', 'Resaltador (H)'], ['subrayado', 'underline', 'Subrayado (U)'], ['texto', 'type', 'Texto (T)'], ['borrador', 'eraser', 'Borrador (E)']]
const ATAJOS = { v: 'seleccion', b: 'dibujo', p: 'lapiz', h: 'resaltado', u: 'subrayado', t: 'texto', e: 'borrador' }
const COLORES = [['Amarillo', '#F7D046'], ['Verde', '#5BC98C'], ['Azul', '#4D8FF7'], ['Rosa', '#EC6FA6'], ['Tinta', '#111C30']]
const COLOR_INICIAL = { resaltado: '#F7D046', subrayado: '#4D8FF7', dibujo: '#EC6FA6', lapiz: '#111C30', texto: '#EC6FA6' }
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const ESTADO_GUARDADO = { guardado: ['Guardado', 'circle-check'], pendiente: ['Cambios sin guardar'], guardando: ['Guardando…'], error: ['No se pudo guardar', 'circle-alert'] }

// C-12 · Visor y editor PDF del cliente. Las anotaciones se acumulan en el navegador y se envían juntas al guardar.
export default function Visor({ id, version: versionPedida, usuario }) {
  const [doc, setDoc] = useState(null)
  const [pdf, setPdf] = useState(null)
  const [error, setError] = useState('')
  const [guardadas, setGuardadas] = useState([])          // anotaciones confirmadas por el backend
  const [nuevas, setNuevas] = useState([])                // creadas y aún no guardadas
  const [borradas, setBorradas] = useState([])            // ids guardados marcados para borrar
  const [historial, setHistorial] = useState({ atras: [], adelante: [] })
  const [estado, setEstado] = useState('guardado')
  const [herramienta, setHerramienta] = useState('seleccion')
  const [color, setColor] = useState(COLOR_INICIAL.resaltado)
  const [grosor, setGrosor] = useState(1)
  const [pagina, setPagina] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [conTexto, setConTexto] = useState(true)
  const [salir, setSalir] = useState(null)
  const [aviso, setAviso] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [base, setBase] = useState(() => Math.min(680, window.innerWidth - 24))
  const temporal = useRef(0)
  const [temarioAbierto, setTemarioAbierto] = useState(() => window.innerWidth >= 1024)
  const navegacion = useRef(0)
  useEffect(() => () => { navegacion.current++ }, [pdf])

  function irPagina(numero) {
    navegacion.current++
    if (!Number.isInteger(numero) || numero < 1 || numero > pdf.numPages) return
    setPagina(numero)
    if (window.innerWidth < 1024) setTemarioAbierto(false)
    window.scrollTo(0, 0)
  }

  async function irDestino(destino) {
    const solicitud = ++navegacion.current
    try {
      const datos = typeof destino === 'string' ? await pdf.getDestination(destino) : destino
      if (!Array.isArray(datos)) throw new Error()
      const indice = Number.isInteger(datos[0]) ? datos[0] : await pdf.getPageIndex(datos[0])
      if (!Number.isInteger(indice) || indice < 0 || indice >= pdf.numPages) throw new Error()
      if (solicitud === navegacion.current) irPagina(indice + 1)
    } catch {
      if (solicitud === navegacion.current) setError('No se pudo localizar el destino de este enlace en el PDF.')
    }
  }

  const vigente = doc?.version
  const numeroVersion = versionPedida || vigente
  const editable = !!doc && numeroVersion === vigente
  const sucio = nuevas.length > 0 || borradas.length > 0
  const informar = useCallback(m => setError(m), [])

  // Carga del documento (metadatos, PDF y anotaciones de la versión abierta).
  useEffect(() => {
    let vigenteCarga = true, tarea
    setPdf(null); setError(''); setNuevas([]); setBorradas([]); setHistorial({ atras: [], adelante: [] }); setEstado('guardado'); setPagina(1)
    async function cargar() {
      const lista = await miBiblioteca()
      const meta = lista.find(d => d.id === id)
      if (!meta) { if (vigenteCarga) setDoc(false); return }
      const numero = versionPedida || meta.version
      const [archivo, marcas] = await Promise.all([contenido(id, numero), leerAnotaciones(id, numero)])
      if (!vigenteCarga) return
      const recursos = import.meta.env.DEV ? '/node_modules/pdfjs-dist/' : '/pdfjs/'
      tarea = getDocument({ data: new Uint8Array(archivo), isEvalSupported: false, cMapUrl: recursos + 'cmaps/', cMapPacked: true,
        standardFontDataUrl: recursos + 'standard_fonts/', wasmUrl: recursos + 'wasm/', iccUrl: recursos + 'iccs/' })
      const cargado = await tarea.promise
      if (vigenteCarga) { setDoc(meta); setGuardadas(marcas); setPdf(cargado) }
    }
    cargar().catch(e => { if (vigenteCarga) setError(e.response?.status === 404 ? 'Esta versión del documento no está disponible.' : mensaje(e)) })
    return () => { vigenteCarga = false; tarea?.destroy() }
  }, [id, versionPedida, recarga])

  // Protección existente: cada 15 s se comprueba que el documento siga asignado y en la misma versión.
  useEffect(() => {
    if (!doc) return
    const revisar = async () => {
      try {
        const actual = (await miBiblioteca()).find(d => d.id === id)
        if (!actual) setDoc(false)
        else if (actual.version !== doc.version) setAviso(`Tu administrador subió la versión ${actual.version} de este documento.`)
      } catch { /* si la sesión terminó, el cliente HTTP ya redirige al inicio de sesión */ }
    }
    const t = setInterval(revisar, 15000)
    return () => clearInterval(t)
  }, [doc, id])

  // En pantallas angostas la página se ajusta al ancho disponible (100 % = ancho de la pantalla).
  useEffect(() => {
    const medir = () => setBase(Math.min(680, window.innerWidth - 24))
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  // Aviso del navegador si se intenta cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!sucio) return
    const avisar = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [sucio])

  const visibles = useMemo(() => [...guardadas.filter(a => !borradas.includes(a.id)), ...nuevas], [guardadas, borradas, nuevas])
  const registrar = accion => { setHistorial(h => ({ atras: [...h.atras, accion], adelante: [] })); setEstado('pendiente') }

  function crear(datos) {
    const anot = { ...datos, temp: 't' + (++temporal.current) }
    setNuevas(n => [...n, anot]); registrar({ tipo: 'crear', anot })
  }
  function borrar(anot) {
    if (anot.temp) setNuevas(n => n.filter(x => x.temp !== anot.temp)); else setBorradas(b => [...b, anot.id])
    registrar({ tipo: 'borrar', anot })
  }
  function aplicar(accion, revertir) {
    const { anot } = accion
    const quitar = (accion.tipo === 'crear') === revertir
    if (anot.temp) setNuevas(n => quitar ? n.filter(x => x.temp !== anot.temp) : [...n, anot])
    else setBorradas(b => quitar ? [...b, anot.id] : b.filter(x => x !== anot.id))
  }
  function deshacer() {
    const accion = historial.atras.at(-1); if (!accion) return
    aplicar(accion, true); setHistorial(h => ({ atras: h.atras.slice(0, -1), adelante: [...h.adelante, accion] })); setEstado('pendiente')
  }
  function rehacer() {
    const accion = historial.adelante.at(-1); if (!accion) return
    aplicar(accion, false); setHistorial(h => ({ atras: [...h.atras, accion], adelante: h.adelante.slice(0, -1) })); setEstado('pendiente')
  }

  async function guardar() {
    if (!sucio || estado === 'guardando') return true
    setEstado('guardando')
    try {
      const sinTemp = nuevas.map(({ temp, ...resto }) => resto)
      const r = await guardarAnotaciones(id, vigente, sinTemp, borradas)
      setGuardadas(r.anotaciones); setNuevas([]); setBorradas([]); setHistorial({ atras: [], adelante: [] }); setEstado('guardado')
      return true
    } catch (e) { setEstado('error'); setError(mensaje(e)); return false }
  }

  function elegir(h) {
    setHerramienta(h)
    if (COLOR_INICIAL[h]) setColor(COLOR_INICIAL[h])
  }

  // Atajos de teclado: herramientas, deshacer/rehacer, guardar y cambio de página.
  useEffect(() => {
    const tecla = e => {
      if (e.target.closest('input, textarea, select, [role="dialog"]')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (editable) guardar(); return }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (editable) (e.shiftKey ? rehacer : deshacer)(); return }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); if (editable) rehacer(); return }
      if (mod || e.altKey) return
      if (editable && ATAJOS[e.key.toLowerCase()]) elegir(ATAJOS[e.key.toLowerCase()])
      if (pdf && e.key === 'PageDown') setPagina(p => Math.min(pdf.numPages, p + 1))
      if (pdf && e.key === 'PageUp') setPagina(p => Math.max(1, p - 1))
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const volver = () => sucio ? setSalir('/biblioteca') : navigate('/biblioteca')
  const abrirVersion = n => {
    const destino = '/biblioteca/' + id + (n == null || n === vigente ? '' : '?version=' + n)
    if (sucio) return setSalir(destino)
    if (destino === '/biblioteca/' + id && !versionPedida) setRecarga(r => r + 1); else navigate(destino)
  }

  if (doc === false) return <main className="nx-visor"><div className="nx-page"><EmptyState icon="lock" title="Este documento ya no está disponible"
    action={<Button onClick={() => navigate('/biblioteca')}>Volver a mis documentos</Button>}>Tu administrador lo quitó de tu biblioteca o cambió tu acceso.</EmptyState></div></main>

  const mostrado = estado === 'pendiente' && !sucio ? 'guardado' : estado
  const guardado = ESTADO_GUARDADO[mostrado]
  const opciones = editable && ['dibujo', 'lapiz', 'resaltado', 'subrayado', 'texto'].includes(herramienta)
  const sinTexto = !conTexto && ['resaltado', 'subrayado'].includes(herramienta)
  return <div className="nx-visor">
    <header className="nx-visor__head">
      <div className="nx-visor__left">
        <Button variant="text" size="sm" icon="chevron-left" onClick={volver} aria-label="Volver a mis documentos"><span className="nx-visor__back-text">Mis documentos</span></Button>
        <span className="nx-visor__divider" />
        {pdf && <Button variant="secondary" size="sm" aria-expanded={temarioAbierto}
          onClick={() => setTemarioAbierto(abierto => !abierto)}>Temario</Button>}
        <div className="nx-visor__title"><strong>{doc?.titulo || 'Abriendo documento…'}</strong>
          {doc && <span className="nx-caption nx-muted nx-visor__meta">{plural(pdf?.numPages || doc.paginas, 'página', 'páginas')}{doc.asignado_en ? ' · Asignado el ' + fecha(doc.asignado_en) : ''}</span>}</div>
        {doc && doc.versiones.length > 1 && <Menu label="Versiones" items={doc.versiones.map(v => ({ label: `Versión ${v.numero}${v.numero === vigente ? ' (vigente)' : ''} · ${fecha(v.creado_en)}`,
          icon: v.numero === numeroVersion ? 'check' : 'file-text', onSelect: () => abrirVersion(v.numero) }))}
          trigger={p => <Button variant="secondary" size="sm" {...p}>Versión {numeroVersion}{editable ? '' : ' (anterior)'}</Button>} />}
      </div>
      {editable && <div className="nx-visor__right">
        {guardado && <span className={'nx-save nx-save--' + mostrado} role="status">{guardado[1] && <Icon name={guardado[1]} size={16} />}{guardado[0]}</span>}
        <Button size="sm" icon="save" loading={estado === 'guardando'} disabled={!sucio} onClick={guardar}>{estado === 'guardando' ? 'Guardando…' : 'Guardar'}</Button>
      </div>}
    </header>
    <div className={pdf && temarioAbierto ? 'nx-visor__lectura con-temario' : 'nx-visor__lectura'}>
    {pdf && temarioAbierto && <Temario pdf={pdf} pagina={pagina} ir={irDestino} irPagina={irPagina} />}
    <div className="nx-visor__stage">
      {doc && <div className="nx-floating">
        {editable ? <div className="nx-toolbar" role="toolbar" aria-label="Herramientas de anotación">
          {HERRAMIENTAS.map(([h, icono, nombre]) => <IconButton key={h} icon={icono} label={nombre} pressed={herramienta === h} onClick={() => elegir(h)}
            disabled={!conTexto && ['resaltado', 'subrayado'].includes(h)} />)}
          <span className="nx-toolbar__divider" />
          <IconButton icon="undo-2" label="Deshacer (Ctrl+Z)" onClick={deshacer} disabled={!historial.atras.length} />
          <IconButton icon="redo-2" label="Rehacer (Ctrl+Mayús+Z)" onClick={rehacer} disabled={!historial.adelante.length} />
        </div> : <div className="nx-readonly"><Icon name="lock" size={16} />Versión anterior · Solo consulta de tus anotaciones</div>}
        {opciones && <div className="nx-tool-options" role="group" aria-label="Opciones de la herramienta">
          <span className="nx-caption nx-muted">Color</span>
          {COLORES.map(([nombre, valor]) => <button key={valor} type="button" className="nx-swatch" aria-pressed={color === valor} aria-label={nombre}
            title={nombre} onClick={() => setColor(valor)}><i style={{ background: valor }} /></button>)}
          {['dibujo', 'lapiz'].includes(herramienta) && <><span className="nx-toolbar__divider" style={{ height: 20 }} /><span className="nx-caption nx-muted">Grosor</span>
            {[4, 7, 11].map((d, i) => <button key={d} type="button" className="nx-thickness" aria-pressed={grosor === i} aria-label={['Fino', 'Medio', 'Grueso'][i]}
              onClick={() => setGrosor(i)}><i style={{ width: d, height: d }} /></button>)}</>}
        </div>}
      </div>}
      {aviso && <div className="nx-visor__alert"><InlineAlert type="info">{aviso} {editable && 'Guarda tus cambios y luego '}
        <Button variant="text" size="sm" onClick={() => { setAviso(''); abrirVersion(null) }}>abre la versión nueva</Button>.</InlineAlert></div>}
      {sinTexto && <div className="nx-visor__alert"><InlineAlert type="info">Esta página no tiene texto seleccionable (por ejemplo, un PDF escaneado). Usa el dibujo libre, el lápiz o el texto.</InlineAlert></div>}
      {error && <div className="nx-visor__alert"><InlineAlert type="error">{error}</InlineAlert></div>}
      {pdf ? <div className="nx-page-wrap">
        <Pagina pdf={pdf} numero={pagina} ancho={Math.round(base * zoom)} anotaciones={visibles.filter(a => a.pagina === pagina)}
          herramienta={editable ? herramienta : 'seleccion'} color={color} grosor={grosor} editable={editable} codigo={usuario}
          onCrear={crear} onBorrar={borrar} onTexto={setConTexto} informar={informar} irDestino={irDestino} />
      </div> : !error && <Spinner label="Abriendo documento…" />}
    </div>
    </div>
    {pdf && <nav className="nx-page-controls" aria-label="Páginas y zoom">
      <IconButton icon="chevron-left" size="sm" label="Página anterior" tooltip={false} disabled={pagina === 1} onClick={() => setPagina(p => p - 1)} />
      <output aria-live="polite">{pagina} / {pdf.numPages}</output>
      <IconButton icon="chevron-right" size="sm" label="Página siguiente" tooltip={false} disabled={pagina === pdf.numPages} onClick={() => setPagina(p => p + 1)} />
      <span className="nx-page-controls__divider" />
      <IconButton icon="zoom-out" size="sm" label="Alejar" tooltip={false} disabled={zoom === ZOOMS[0]} onClick={() => setZoom(z => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} />
      <output>{Math.round(zoom * 100)} %</output>
      <IconButton icon="zoom-in" size="sm" label="Acercar" tooltip={false} disabled={zoom === ZOOMS.at(-1)} onClick={() => setZoom(z => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} />
      <span className="nx-page-controls__divider" />
      <IconButton icon="maximize-2" size="sm" label="Ajustar a la pantalla" tooltip={false} onClick={() => setZoom(1)} />
    </nav>}
    {salir && <Modal size="sm" title="¿Salir sin guardar?" onClose={() => setSalir(null)} footer={<>
      <Button variant="text" onClick={() => setSalir(null)}>Seguir editando</Button>
      <Button variant="secondary" onClick={() => { const d = salir; setNuevas([]); setBorradas([]); setSalir(null); navigate(d) }}>Descartar y salir</Button>
      <Button onClick={async () => { const d = salir; if (await guardar()) { setSalir(null); navigate(d) } else setSalir(null) }}>Guardar y salir</Button></>}>
      <p className="nx-body-sm nx-muted">Tienes cambios sin guardar en este documento. Si sales ahora, se perderán las anotaciones que hiciste desde el último guardado.</p>
    </Modal>}
  </div>
}
