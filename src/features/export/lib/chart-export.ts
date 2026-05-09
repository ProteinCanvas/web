export async function svgElementToPng(
  svgEl: SVGElement,
  opts?: { background?: string; scale?: number }
): Promise<string | null> {
  const scale = opts?.scale ?? 2
  const background = opts?.background ?? '#ffffff'
  const bbox = svgEl.getBoundingClientRect()
  const w = Math.round(bbox.width * scale)
  const h = Math.round(bbox.height * scale)

  const clone = svgEl.cloneNode(true) as SVGElement
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))

  const styleEls = document.querySelectorAll('style, link[rel="stylesheet"]')
  let cssText = ''
  styleEls.forEach((el) => {
    if (el.tagName === 'STYLE') cssText += el.textContent ?? ''
  })

  if (cssText) {
    const defs = clone.querySelector('defs') ?? document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = cssText
    defs.appendChild(style)
    if (!clone.querySelector('defs')) clone.insertBefore(defs, clone.firstChild)
  }

  const svgStr = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return }
      ctx.fillStyle = background
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export function svgElementToString(svgEl: SVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(clone)
}

export function downloadBlob(content: string | Blob, filename: string, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}
