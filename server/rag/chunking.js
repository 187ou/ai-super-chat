/** 轻量文本分块：按字符长度切片，并留有重叠，减少跨段信息丢失 */

export function normalizeText(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim()
}

export function chunkText(text, opts = {}) {
  const input = normalizeText(text)
  if (!input) return []

  const chunkSize = Number(opts.chunkSize ?? 1200)
  const overlap = Number(opts.overlap ?? 150)
  const maxChunks = Number(opts.maxChunks ?? 200)

  if (chunkSize <= overlap) {
    throw new Error('chunkSize 必须大于 overlap')
  }

  const step = chunkSize - overlap
  const out = []

  for (let i = 0; i < input.length; i += step) {
    out.push(input.slice(i, i + chunkSize))
    if (out.length >= maxChunks) break
  }

  return out.filter((t) => t.trim().length > 0)
}

