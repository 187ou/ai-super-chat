import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { Conversation } from '../types'
import { formatMessagePlainText } from './chatMessageFormat'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeFilename(name: string): string {
  const s = name.replace(/[/\\?%*:|"<>]/g, '_').trim() || '对话'
  return s.slice(0, 80)
}

function buildExportElement(conv: Conversation): HTMLElement {
  const title = escapeHtml(conv.title || '对话')
  const timeStr = escapeHtml(new Date(conv.updatedAt).toLocaleString('zh-CN'))

  const blocks = conv.messages
    .map((m) => {
      const label = m.role === 'user' ? '我' : 'AI 助手'
      const body = escapeHtml(formatMessagePlainText(m))
      return `<section style="margin-bottom:18px;page-break-inside:avoid;">
        <div style="font-weight:600;font-size:11px;color:#71717a;margin-bottom:6px;">${label}</div>
        <div style="font-size:12px;line-height:1.6;color:#18181b;white-space:pre-wrap;word-break:break-word;border-left:3px solid #e4e4e7;padding-left:12px;">${body}</div>
      </section>`
    })
    .join('')

  const wrap = document.createElement('div')
  wrap.innerHTML = `
    <div class="pdf-export-root" style="box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;padding:24px;color:#18181b;background:#ffffff;width:794px;">
      <header style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e4e4e7;">
        <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;color:#18181b;">${title}</h1>
        <p style="font-size:11px;color:#71717a;margin:0;">导出时间：${timeStr}</p>
      </header>
      <main>${blocks}</main>
    </div>
  `.trim()
  const el = wrap.firstElementChild as HTMLElement
  if (!el) throw new Error('RENDER_FAILED')
  return el
}

/**
 * 挂到独立 iframe：不继承主文档 Tailwind 的 oklch()，避免 html2canvas 解析失败
 */
function mountPdfInIsolation(el: HTMLElement): { iframe: HTMLIFrameElement; cleanup: () => void } {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'pdf-export')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;left:-12000px;top:0;width:820px;border:0;opacity:1;pointer-events:none;overflow:hidden'

  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('IFRAME_DOCUMENT')
  }

  doc.open()
  doc.write(`<!DOCTYPE html>
<html lang="zh-CN" style="color:#18181b;background-color:#ffffff;">
<head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background-color:#ffffff;color:#18181b;}
  *{box-sizing:border-box;}
</style>
</head><body style="background-color:#ffffff;"></body></html>`)
  doc.close()
  doc.body.appendChild(el)

  const h = Math.ceil(Math.max(el.scrollHeight, el.offsetHeight, 400)) + 8
  iframe.style.height = `${h}px`

  return {
    iframe,
    cleanup: () => {
      document.body.removeChild(iframe)
    },
  }
}

/**
 * 将当前会话导出为 PDF（html2canvas + jsPDF；隔离 iframe 避免 oklch 与主站样式冲突）
 */
export async function downloadConversationPdf(conv: Conversation): Promise<void> {
  if (!conv.messages.length) {
    throw new Error('EMPTY_CONVERSATION')
  }

  const el = buildExportElement(conv)
  const { cleanup } = mountPdfInIsolation(el)

  const filename = `${sanitizeFilename(conv.title)}.pdf`

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => {})
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    const canvas = await html2canvas(el, {
      scale: Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 2),
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      foreignObjectRendering: false,
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    })

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 10
    const contentWidth = pageWidth - margin * 2
    const contentHeight = pageHeight - margin * 2

    const totalHeightMm = (canvas.height * contentWidth) / canvas.width
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    if (totalHeightMm <= contentHeight + 0.5) {
      pdf.addImage(imgData, 'JPEG', margin, margin, contentWidth, totalHeightMm)
    } else {
      const pageSourceHeightPx = (contentHeight / totalHeightMm) * canvas.height
      let sourceY = 0
      let page = 0

      while (sourceY < canvas.height) {
        const sliceH = Math.min(pageSourceHeightPx, canvas.height - sourceY)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = Math.ceil(sliceH)
        const ctx = sliceCanvas.getContext('2d')
        if (!ctx) throw new Error('CANVAS_CONTEXT')
        ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92)
        const sliceHeightMm = (sliceH / canvas.height) * totalHeightMm

        if (page > 0) pdf.addPage()
        pdf.addImage(sliceData, 'JPEG', margin, margin, contentWidth, sliceHeightMm)
        sourceY += sliceH
        page++
      }
    }

    pdf.save(filename)
  } finally {
    cleanup()
  }
}
