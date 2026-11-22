import { useEffect, useState } from 'react'
import { Button } from '../components/Button'

function Entradas({ items, ir }) {
  return <ul>{items.map((item, i) => <li key={i}>
    {item.dest != null
      ? <button type="button" onClick={() => ir(item.dest)}>{item.title}</button>
      : <span>{item.title}</span>}
    {item.items?.length > 0 && <Entradas items={item.items} ir={ir} />}
  </li>)}</ul>
}

export default function Temario({ pdf, pagina, ir, irPagina }) {
  const [items, setItems] = useState(null)
  const [numero, setNumero] = useState(String(pagina))
  useEffect(() => {
    let activo = true
    pdf.getOutline().then(resultado => {
      if (activo) setItems(resultado || [])
    }).catch(() => { if (activo) setItems([]) })
    return () => { activo = false }
  }, [pdf])
  useEffect(() => { setNumero(String(pagina)) }, [pagina])

  return <nav aria-label="Temario del documento" className="nx-temario">
    <h2>Temario</h2>
    <form onSubmit={e => { e.preventDefault(); irPagina(Number(numero)) }}>
      <label>Página <input required type="number" min="1" max={pdf.numPages} value={numero}
        onChange={e => setNumero(e.target.value)} /></label>
      <span>de {pdf.numPages}</span><Button size="sm" type="submit">Ir</Button>
    </form>
    {items === null ? <p>Cargando temario…</p> : items.length
      ? <Entradas items={items} ir={ir} />
      : <p>Este PDF no incluye marcadores. Puedes ir directamente a una página.</p>}
  </nav>
}
