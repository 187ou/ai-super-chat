const DEFAULT_STOPWORDS = new Set([
  '的',
  '了',
  '和',
  '是',
  '在',
  '就',
  '对',
  '与',
  '及',
  '以及',
  '请',
  '帮',
  '想',
  '知道',
  '怎么',
  '什么',
  '哪个',
  '哪些',
  '这个',
  '那个',
  '他们',
  '我们',
  '你',
  '我',
  '他',
  '她',
])

export function extractKeywords(question, opts = {}) {
  const q = String(question ?? '').trim()
  if (!q) return []
  const stopwords = opts.stopwords ?? DEFAULT_STOPWORDS

  const raw =
    q.match(/[a-zA-Z0-9]{2,}|[\u4e00-\u9fa5]{2,}/g) ??
    q.match(/[a-zA-Z0-9]{1,}|[\u4e00-\u9fa5]{1,}/g) ??
    []

  const keywords = raw
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 20)
    .filter((s) => !stopwords.has(s))

  // 去重 + 限制数量
  const uniq = Array.from(new Set(keywords))
  return uniq.slice(0, Number(opts.maxKeywords ?? 25))
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0
  let count = 0
  let startIndex = 0
  while (true) {
    const idx = haystack.indexOf(needle, startIndex)
    if (idx === -1) break
    count += 1
    startIndex = idx + needle.length
  }
  return count
}

export function retrieveTopChunks(chunks, question, opts = {}) {
  const topK = Number(opts.topK ?? 6)
  const keywords = extractKeywords(question, opts)
  const scored = []

  for (const c of chunks) {
    const text = String(c.text ?? '')
    if (!text) continue

    if (keywords.length === 0) {
      // 没有关键词时，按长度与前置信息兜底（更容易命中开头的定义）
      scored.push({ chunk: c, score: Math.min(1, text.length / 2000) })
      continue
    }

    let score = 0
    for (const kw of keywords) {
      const n = countOccurrences(text, kw)
      // 关键字出现次数越多越相关；稍微惩罚极短命中（避免噪音）
      if (n > 0) score += n * (kw.length <= 1 ? 0.2 : 1)
    }

    // 允许 chunk 内同时包含多个关键词时更高分
    score += Math.min(3, keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0)) * 0.25

    if (score > 0) scored.push({ chunk: c, score })
  }

  // 如果完全没命中，按长度降序兜底取前 topK
  if (!scored.length) {
    const fallback = [...chunks]
      .map((c) => ({ chunk: c, score: Math.min(1, String(c.text ?? '').length / 2000) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
    return fallback.map((x) => x.chunk)
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK).map((x) => x.chunk)
}

