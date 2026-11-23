import { useEffect, useRef, useState } from 'react'
import { TextLayer } from 'pdfjs-dist/legacy/build/pdf.mjs'

// Grosor de cada herramienta de trazo, relativo al ancho de la página (S, M, L).
export const GROSORES = { dibujo: [0.008, 0.012, 0.018], lapiz: [0.0015, 0.0025, 0.004] }
const TAMANO_TEXTO = 13 / 680  // 13 px con la página a 680 px (100 %), como en el diseño.

// Una página del PDF: lienzo de pdf.js, capa de texto seleccionable, capa de anotaciones y marca de agua.
// Todas las coordenadas de las anotaciones son relativas a la página (0 a 1), así se ven igual con cualquier zoom.
export default function Pagina({ pdf, numero, ancho, altoInicial, anotaciones, herramienta, color, grosor, editable, codigo, onCrear, onBorrar, onTexto, onMedida, informar, irDestino }) {
  const hoja = useRef(null), lienzo = useRef(null), capaTexto = useRef(null)
  const [alto, setAlto] = useState(altoInicial ?? ancho * 1.414)
  const [trazo, setTrazo] = useState(null)
  const [entrada, setEntrada] = useState(null)
  const [enlaces, setEnlaces] = useState([])

  useEffect(() => {
    let activo = true
    setEnlaces([])
    async function cargar() {
      const pagina = await pdf.getPage(numero)
      const vista = pagina.getViewport({ scale: 1 })
      const elementos = await pagina.getAnnotations({ intent: 'display' })
      const internos = elementos.filter(a => a.subtype === 'Link' && a.dest != null && a.rect?.length === 4)
      if (activo) setEnlaces(internos.map(a => {
        const [x1, y1, x2, y2] = vista.convertToViewportRectangle(a.rect)
        return { id: a.id, dest: a.dest, titulo: a.contentsObj?.str || a.titleObj?.str,
          style: { left: Math.min(x1, x2) / vista.width * 100 + '%', top: Math.min(y1, y2) / vista.height * 100 + '%',
            width: Math.abs(x2-x1) / vista.width * 100 + '%', height: Math.abs(y2-y1) / vista.height * 100 + '%' } }
      }))
    }
    cargar().catch(() => { if (activo) setEnlaces([]) })
    return () => { activo = false }
  }, [pdf, numero])

  useEffect(() => {
    let cancelado = false, render, texto
    async function dibujar() {
      const pagina = await pdf.getPage(numero)
      if (cancelado) return
      const base = pagina.getViewport({ scale: 1 })
      const viewport = pagina.getViewport({ scale: ancho / base.width })
      setAlto(viewport.height)
      onMedida?.(viewport.height / viewport.width)
      hoja.current.style.setProperty('--total-scale-factor', viewport.scale * pagina.userUnit)
      const densidad = Math.min(window.devicePixelRatio || 1, 2)
      const cv = lienzo.current
      cv.width = Math.floor(viewport.width * densidad); cv.height = Math.floor(viewport.height * densidad)
      render = pagina.render({ canvas: cv, viewport, transform: [densidad, 0, 0, densidad, 0, 0] })
      const contenido = await pagina.getTextContent()
      if (cancelado) return
      onTexto?.(contenido.items.some(i => i.str?.trim()))
      capaTexto.current.replaceChildren()
      texto = new TextLayer({ textContentSource: contenido, container: capaTexto.current, viewport })
      await Promise.all([render.promise, texto.render()])
    }
    dibujar().catch(e => { if (!cancelado && e?.name !== 'RenderingCancelledException') informar(e.message) })
    return () => { cancelado = true; render?.cancel(); texto?.cancel() }
  }, [pdf, numero, ancho, informar, onTexto, onMedida])

  const relativo = e => {
    const r = hoja.current.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]
  }

  // Resaltado y subrayado: se crean al soltar una selección de texto con la herramienta activa.
  function seleccion() {
    if (!editable || !['resaltado', 'subrayado'].includes(herramienta)) return
    const sel = window.getSelection()
    if (!sel?.rangeCount || sel.isCollapsed) return
    const rango = sel.getRangeAt(0)
    if (!capaTexto.current.contains(rango.commonAncestorContainer)) return
    const l = hoja.current.getBoundingClientRect()
    const rectangulos = [...rango.getClientRects()].map(r => {
      const x = Math.max(r.left, l.left), y = Math.max(r.top, l.top)
      return [(x - l.left) / l.width, (y - l.top) / l.height, (Math.min(r.right, l.right) - x) / l.width, (Math.min(r.bottom, l.bottom) - y) / l.height]
    }).filter(r => r[2] > 0.001 && r[3] > 0.001).map(r => r.map(v => Math.round(v * 10000) / 10000))
    const texto = sel.toString().trim()
    sel.removeAllRanges()
    if (rectangulos.length && texto) onCrear({ tipo: herramienta, pagina: numero, texto: texto.slice(0, 10000), rectangulos: rectangulos.slice(0, 500), color })
  }

  // Dibujo libre y lápiz: un trazo por anotación, para poder borrarlo o deshacerlo por separado.
  const dibujando = editable && (herramienta === 'dibujo' || herramienta === 'lapiz')
  function bajar(e) {
    if (dibujando) { e.currentTarget.setPointerCapture(e.pointerId); setTrazo([relativo(e)]) }
    else if (editable && herramienta === 'texto') {
      e.preventDefault()  // evita que el clic le quite el foco al campo recién creado
      if (entrada) return confirmarTexto()
      const [x, y] = relativo(e); setEntrada({ x, y, valor: '' })
    }
  }
  function mover(e) {
    if (!trazo) return
    const p = relativo(e), u = trazo.at(-1)
    if (Math.hypot(p[0] - u[0], p[1] - u[1]) > 0.002 && trazo.length < 4000) setTrazo(t => [...t, p.map(v => Math.round(v * 10000) / 10000)])
  }
  function soltar() {
    if (!trazo) return
    const puntos = trazo.length === 1 ? [trazo[0], trazo[0]] : trazo
    onCrear({ tipo: herramienta, pagina: numero, color, trazos: [{ puntos, grosor: GROSORES[herramienta][grosor] }] })
    setTrazo(null)
  }
  function confirmarTexto() {
    const contenido = entrada?.valor.trim()
    if (contenido) {
      const ancho = Math.min(1 - entrada.x, Math.max(0.05, contenido.length * TAMANO_TEXTO * 0.55))
      onCrear({ tipo: 'texto', pagina: numero, color, contenido: contenido.slice(0, 2000), rectangulos: [[entrada.x, entrada.y, Math.round(ancho * 10000) / 10000, TAMANO_TEXTO * 1.4]] })
    }
    setEntrada(null)
  }

  const W = ancho, H = alto, fuente = TAMANO_TEXTO * W
  const borrar = a => () => herramienta === 'borrador' && editable && onBorrar(a)
  const clase = 'nx-hoja' + (herramienta === 'borrador' && editable ? ' nx-hoja--borrador' : '') + (!['resaltado', 'subrayado', 'seleccion'].includes(herramienta) ? ' nx-hoja--sin-texto' : '')
  return <div ref={hoja} className={clase} style={{ width: W, height: H }} onPointerUp={seleccion} onKeyUp={seleccion}>
    <canvas ref={lienzo} />
    <div ref={capaTexto} className="textLayer" />
    {herramienta === 'seleccion' && enlaces.map((enlace, i) =>
      <button key={enlace.id} className="nx-enlace-pdf" type="button" style={enlace.style}
        aria-label={enlace.titulo || `Seguir enlace interno ${i + 1}`} onClick={() => irDestino(enlace.dest)} />)}
    <svg className="nx-capa" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {anotaciones.map(a => {
        const clave = a.id ?? a.temp
        if (a.tipo === 'resaltado') return <g key={clave} className="nx-resaltado" data-borrable onClick={borrar(a)}>
          {a.rectangulos.map(([x, y, w, h], i) => <rect key={i} x={x * W} y={y * H} width={w * W} height={h * H} fill={a.color} fillOpacity=".45" />)}</g>
        if (a.tipo === 'subrayado') return <g key={clave} data-borrable onClick={borrar(a)}>
          {a.rectangulos.map(([x, y, w, h], i) => <rect key={i} x={x * W} y={(y + h) * H - Math.max(1.5, W * 0.003)} width={w * W} height={Math.max(1.5, W * 0.003)} fill={a.color} />)}</g>
        if (a.tipo === 'dibujo' || a.tipo === 'lapiz') return <g key={clave} data-borrable onClick={borrar(a)} opacity={a.tipo === 'dibujo' ? 0.5 : 1}>
          {a.trazos.map((t, i) => <polyline key={i} points={t.puntos.map(([x, y]) => `${x * W},${y * H}`).join(' ')} fill="none" stroke={a.color}
            strokeWidth={Math.max(1, t.grosor * W)} strokeLinecap="round" strokeLinejoin="round" />)}</g>
        return null
      })}
      {trazo && <polyline points={trazo.map(([x, y]) => `${x * W},${y * H}`).join(' ')} fill="none" stroke={color} opacity={herramienta === 'dibujo' ? 0.5 : 1}
        strokeWidth={Math.max(1, GROSORES[herramienta][grosor] * W)} strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
    {anotaciones.filter(a => a.tipo === 'texto').map(a => { const [x, y] = a.rectangulos[0]
      return <div key={a.id ?? a.temp} className="nx-nota" onClick={borrar(a)} style={{ left: x * W, top: y * H, color: a.color, fontSize: fuente, maxWidth: (1 - x) * W }}>{a.contenido}</div> })}
    <div className="nx-agua" aria-hidden="true" style={{ fontSize: Math.min(40, W * 0.042) }}>{codigo}</div>
    {editable && ['dibujo', 'lapiz', 'texto'].includes(herramienta) && <div className={'nx-captura nx-captura--' + (herramienta === 'texto' ? 'texto' : 'dibujo')}
      onPointerDown={bajar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} />}
    {entrada && <input className="nx-entrada-texto" autoFocus aria-label="Texto de la anotación" value={entrada.valor} maxLength={2000}
      style={{ left: entrada.x * W, top: entrada.y * H, fontSize: fuente, color }}
      onChange={e => setEntrada(v => ({ ...v, valor: e.target.value }))} onBlur={confirmarTexto}
      onKeyDown={e => { if (e.key === 'Enter') confirmarTexto(); if (e.key === 'Escape') setEntrada(null) }} />}
  </div>
}
