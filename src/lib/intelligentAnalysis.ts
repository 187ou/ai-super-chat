import type { EChartsOption } from 'echarts'

export type MetricPoint = {
  day: string
  calls: number
  latencyMs: number
  errorRate: number
}

export type AlertItem = {
  id: string
  level: 'critical' | 'warning'
  title: string
  detail: string
  day: string
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function stdDev(nums: number[]): number {
  if (nums.length <= 1) return 0
  const m = avg(nums)
  const variance = nums.reduce((a, n) => a + (n - m) ** 2, 0) / nums.length
  return Math.sqrt(variance)
}

export function mockLast30Days(): MetricPoint[] {
  const out: MetricPoint[] = []
  for (let i = 0; i < 30; i += 1) {
    const day = `D${i + 1}`
    const weekly = Math.sin((i / 7) * Math.PI * 2)
    const trend = i * 23
    const calls = Math.round(860 + weekly * 130 + trend + (Math.random() * 90 - 45))
    const latency = Math.round(95 + (1 - weekly) * 12 + Math.random() * 14)
    const errorRate = Number((0.5 + Math.random() * 0.45).toFixed(2))
    out.push({ day, calls, latencyMs: latency, errorRate })
  }

  // 人工注入 2 个异常点，方便演示告警
  out[22] = { ...out[22], latencyMs: out[22].latencyMs + 110, errorRate: Number((out[22].errorRate + 1.8).toFixed(2)) }
  out[26] = { ...out[26], calls: Math.max(180, Math.round(out[26].calls * 0.52)) }
  return out
}

export function buildForecast(last30: MetricPoint[]) {
  const calls = last30.map((d) => d.calls)
  const recent = calls.slice(-7)
  const slope = (recent[recent.length - 1] - recent[0]) / Math.max(1, recent.length - 1)
  const baseline = avg(recent)
  const sigma = Math.max(30, stdDev(recent))

  const next7 = Array.from({ length: 7 }).map((_, i) => {
    const mean = Math.max(0, Math.round(baseline + slope * (i + 1)))
    const low = Math.max(0, Math.round(mean - sigma * 1.2))
    const high = Math.max(mean + 1, Math.round(mean + sigma * 1.2))
    return { day: `F${i + 1}`, mean, low, high }
  })
  return next7
}

export function buildForecastChartOption(history: MetricPoint[]): EChartsOption {
  const forecast = buildForecast(history)
  const x = [...history.map((d) => d.day), ...forecast.map((d) => d.day)]
  const callsHistory = history.map((d) => d.calls)
  const means = forecast.map((d) => d.mean)
  const lows = forecast.map((d) => d.low)
  const highs = forecast.map((d) => d.high)
  const padding = new Array(history.length).fill(null)

  return {
    backgroundColor: 'transparent',
    title: { text: '接口调用量趋势预测（未来 7 天）', left: 'center', top: 8 },
    legend: { top: 36, data: ['历史调用量', '预测中位线', '置信下界', '置信上界'] },
    tooltip: { trigger: 'axis' },
    grid: { left: 20, right: 20, top: 74, bottom: 24, containLabel: true },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value', name: '调用量' },
    series: [
      { name: '历史调用量', type: 'line', data: [...callsHistory, ...new Array(7).fill(null)], smooth: true, symbolSize: 6 },
      { name: '预测中位线', type: 'line', data: [...padding, ...means], smooth: true, lineStyle: { type: 'dashed', width: 3 }, symbolSize: 6 },
      { name: '置信下界', type: 'line', data: [...padding, ...lows], smooth: true, lineStyle: { opacity: 0.35 }, symbol: 'none' },
      {
        name: '置信上界',
        type: 'line',
        data: [...padding, ...highs],
        smooth: true,
        lineStyle: { opacity: 0.35 },
        areaStyle: { opacity: 0.12 },
        symbol: 'none',
      },
    ],
  }
}

export function detectAlerts(data: MetricPoint[]): AlertItem[] {
  if (!data.length) return []
  const calls = data.map((d) => d.calls)
  const latency = data.map((d) => d.latencyMs)
  const error = data.map((d) => d.errorRate)

  const callsBase = avg(calls.slice(0, -1))
  const latencyBase = avg(latency.slice(0, -1))
  const errorBase = avg(error.slice(0, -1))

  const out: AlertItem[] = []
  for (const p of data) {
    if (p.latencyMs > latencyBase * 1.45 || p.errorRate > errorBase * 2.2) {
      out.push({
        id: `a-lat-${p.day}`,
        level: 'critical',
        day: p.day,
        title: '响应时间/错误率异常升高',
        detail: `响应时间 ${p.latencyMs}ms，错误率 ${p.errorRate}%（可能是数据库连接池打满或慢查询增多）`,
      })
    } else if (p.calls < callsBase * 0.62) {
      out.push({
        id: `a-call-${p.day}`,
        level: 'warning',
        day: p.day,
        title: '调用量异常下降',
        detail: `调用量降至 ${p.calls}（可能是上游流量切换、网关限流或发布导致）`,
      })
    }
  }
  return out.slice(-6).reverse()
}

