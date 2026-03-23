import type { EChartsOption } from 'echarts'

const MODERN_PALETTE = ['#6366f1', '#22c55e', '#06b6d4', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6']

export function beautifyChartOption(input: EChartsOption): EChartsOption {
  const option = { ...input }
  const series = Array.isArray(option.series) ? option.series : option.series ? [option.series] : []
  const tunedSeries = series.map((s: any) => {
    const next = { ...s }
    if (next.type === 'line') {
      next.smooth = next.smooth ?? true
      next.symbol = next.symbol ?? 'circle'
      next.symbolSize = next.symbolSize ?? 7
      next.lineStyle = { width: 3, ...(next.lineStyle ?? {}) }
      next.areaStyle = next.areaStyle ?? { opacity: 0.12 }
    }
    if (next.type === 'bar') {
      next.barMaxWidth = next.barMaxWidth ?? 34
      next.itemStyle = {
        borderRadius: [8, 8, 0, 0],
        ...(next.itemStyle ?? {}),
      }
    }
    if (next.type === 'pie') {
      next.radius = next.radius ?? ['45%', '72%']
      next.itemStyle = { borderRadius: 10, borderColor: '#fff', borderWidth: 2, ...(next.itemStyle ?? {}) }
      next.label = { formatter: '{b}\n{d}%', ...(next.label ?? {}) }
    }
    return next
  })

  return {
    backgroundColor: 'transparent',
    color: MODERN_PALETTE,
    animationDuration: 700,
    animationEasing: 'cubicOut',
    textStyle: {
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      ...(option.textStyle ?? {}),
    },
    title: {
      left: 'center',
      top: 8,
      textStyle: { fontSize: 16, fontWeight: 700, color: '#0f172a', ...(option.title as any)?.textStyle },
      ...(option.title as any),
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(9, 14, 30, 0.88)',
      borderWidth: 0,
      textStyle: { color: '#f8fafc', fontSize: 12 },
      axisPointer: { type: 'line' },
      ...(option.tooltip as any),
    },
    legend: {
      top: 36,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      ...(option.legend as any),
    },
    grid: {
      left: 20,
      right: 20,
      top: 72,
      bottom: 24,
      containLabel: true,
      ...(option.grid as any),
    },
    xAxis: option.xAxis
      ? {
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisTick: { show: false },
          axisLabel: { color: '#64748b' },
          ...(option.xAxis as any),
        }
      : option.xAxis,
    yAxis: option.yAxis
      ? {
          splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#64748b' },
          ...(option.yAxis as any),
        }
      : option.yAxis,
    series: tunedSeries,
  }
}

export function fromNaturalLanguageToChartOption(input: string): EChartsOption {
  const lower = input.toLowerCase()
  if (
    lower.includes('gantt') ||
    input.includes('甘特')
  ) {
    const tasks = ['需求分析', '架构设计', '编码开发', '联调测试', '上线发布']
    const start = [0, 3, 6, 12, 16]
    const duration = [3, 3, 6, 4, 2]
    return beautifyChartOption({
      title: { text: '项目计划甘特图' },
      legend: { data: ['已排期任务'] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[1] : params
          const idx = p?.dataIndex ?? 0
          return `${tasks[idx]}<br/>开始: 第 ${start[idx]} 天<br/>持续: ${duration[idx]} 天`
        },
      },
      grid: { top: 84, left: 86, right: 24, bottom: 24, containLabel: true },
      xAxis: { type: 'value', name: '天', min: 0, max: 20, splitNumber: 10 },
      yAxis: { type: 'category', data: tasks },
      series: [
        {
          name: '开始偏移',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: 'transparent' },
          emphasis: { disabled: true },
          data: start,
        },
        {
          name: '已排期任务',
          type: 'bar',
          stack: 'total',
          data: duration,
          itemStyle: { borderRadius: [8, 8, 8, 8] },
          label: { show: true, position: 'insideRight', color: '#fff', formatter: '{c}天' },
        },
      ],
    })
  }

  if (
    lower.includes('burndown') ||
    input.includes('燃尽')
  ) {
    return beautifyChartOption({
      title: { text: '敏捷迭代燃尽图' },
      legend: { data: ['理想剩余', '实际剩余'] },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'] },
      yAxis: { type: 'value', name: '剩余工作量(点)' },
      series: [
        { name: '理想剩余', type: 'line', data: [80, 70, 60, 50, 40, 30, 20, 0], smooth: true },
        { name: '实际剩余', type: 'line', data: [80, 76, 72, 61, 54, 43, 30, 12], smooth: true },
      ],
    })
  }

  if (
    lower.includes('kanban') ||
    input.includes('看板')
  ) {
    return beautifyChartOption({
      title: { text: '任务看板流转图' },
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: { focus: 'adjacency' },
          nodeAlign: 'justify',
          data: [
            { name: '待办' },
            { name: '进行中' },
            { name: '测试中' },
            { name: '已完成' },
            { name: '阻塞' },
          ],
          links: [
            { source: '待办', target: '进行中', value: 16 },
            { source: '进行中', target: '测试中', value: 12 },
            { source: '测试中', target: '已完成', value: 10 },
            { source: '进行中', target: '阻塞', value: 4 },
            { source: '阻塞', target: '进行中', value: 2 },
          ],
          lineStyle: { color: 'gradient', curveness: 0.4 },
          label: { color: '#0f172a', fontWeight: 600 },
        },
      ],
    })
  }

  if (
    lower.includes('cumulative flow') ||
    input.includes('累积流量')
  ) {
    return beautifyChartOption({
      title: { text: '累积流量图（CFD）' },
      legend: { data: ['待办', '开发中', '测试中', '已完成'] },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'] },
      yAxis: { type: 'value', name: '任务数' },
      series: [
        { name: '待办', type: 'line', stack: 'flow', areaStyle: { opacity: 0.18 }, data: [26, 24, 22, 18, 14, 10] },
        { name: '开发中', type: 'line', stack: 'flow', areaStyle: { opacity: 0.18 }, data: [8, 11, 12, 10, 8, 7] },
        { name: '测试中', type: 'line', stack: 'flow', areaStyle: { opacity: 0.18 }, data: [3, 4, 6, 7, 6, 5] },
        { name: '已完成', type: 'line', stack: 'flow', areaStyle: { opacity: 0.18 }, data: [2, 6, 10, 16, 24, 33] },
      ],
    })
  }

  if (
    lower.includes('coverage') ||
    input.includes('覆盖率')
  ) {
    return beautifyChartOption({
      title: { text: '代码覆盖率柱状图' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: ['auth', 'order', 'inventory', 'payment', 'report'] },
      yAxis: { type: 'value', name: '覆盖率(%)', min: 0, max: 100 },
      series: [{ name: '覆盖率', type: 'bar', data: [91, 84, 76, 88, 69] }],
    })
  }

  if (
    lower.includes('defect') ||
    input.includes('缺陷趋势') ||
    input.includes('bug')
  ) {
    return beautifyChartOption({
      title: { text: '缺陷趋势折线图' },
      legend: { data: ['新增缺陷', '修复缺陷'] },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'] },
      yAxis: { type: 'value', name: '数量' },
      series: [
        { name: '新增缺陷', type: 'line', data: [21, 24, 18, 16, 13, 11], smooth: true },
        { name: '修复缺陷', type: 'line', data: [10, 15, 17, 19, 16, 15], smooth: true },
      ],
    })
  }

  if (
    lower.includes('complexity') ||
    input.includes('复杂度')
  ) {
    return beautifyChartOption({
      title: { text: '代码复杂度雷达图' },
      tooltip: { trigger: 'item' },
      radar: {
        radius: '62%',
        indicator: [
          { name: '圈复杂度', max: 100 },
          { name: '认知复杂度', max: 100 },
          { name: '重复率', max: 100 },
          { name: '可测试性', max: 100 },
          { name: '可维护性', max: 100 },
          { name: '耦合度', max: 100 },
        ],
      },
      series: [
        {
          name: '质量健康度',
          type: 'radar',
          data: [{ value: [68, 61, 72, 78, 74, 65], name: '当前版本' }],
          areaStyle: { opacity: 0.22 },
        },
      ],
    })
  }

  if (
    lower.includes('structure') ||
    lower.includes('relationship') ||
    input.includes('结构') ||
    input.includes('关系') ||
    input.includes('拓扑')
  ) {
    return beautifyChartOption({
      title: { text: 'AI 生成结构关系图' },
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          symbolSize: 52,
          force: { repulsion: 300, edgeLength: [70, 140] },
          label: { show: true, color: '#0f172a' },
          edgeLabel: { show: true, fontSize: 11, color: '#64748b', formatter: '{c}' },
          lineStyle: { width: 2, curveness: 0.18, opacity: 0.78 },
          data: [
            { name: '网关', category: 0, value: 90 },
            { name: '认证服务', category: 1, value: 80 },
            { name: '订单服务', category: 1, value: 86 },
            { name: '库存服务', category: 1, value: 74 },
            { name: '数据库', category: 2, value: 92 },
          ],
          links: [
            { source: '网关', target: '认证服务', value: 'auth' },
            { source: '网关', target: '订单服务', value: 'route' },
            { source: '订单服务', target: '库存服务', value: 'check' },
            { source: '订单服务', target: '数据库', value: 'write' },
            { source: '认证服务', target: '数据库', value: 'read' },
          ],
          categories: [{ name: '入口层' }, { name: '业务层' }, { name: '数据层' }],
        },
      ],
    })
  }

  if (
    lower.includes('advanced') ||
    lower.includes('analysis') ||
    input.includes('高级分析') ||
    input.includes('分析') ||
    input.includes('洞察')
  ) {
    return beautifyChartOption({
      title: { text: 'AI 生成高级分析图' },
      legend: { data: ['营收', '转化率', '目标线'] },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
      yAxis: [
        { type: 'value', name: '营收(万)' },
        { type: 'value', name: '转化率(%)', min: 0, max: 100 },
      ],
      series: [
        { name: '营收', type: 'bar', data: [320, 410, 465, 530] },
        { name: '目标线', type: 'line', data: [300, 380, 450, 500], smooth: true },
        { name: '转化率', type: 'line', yAxisIndex: 1, data: [41, 48, 52, 60], smooth: true },
      ],
    })
  }

  if (
    lower.includes('performance') ||
    lower.includes('monitor') ||
    input.includes('性能') ||
    input.includes('监控') ||
    input.includes('运维')
  ) {
    return beautifyChartOption({
      title: { text: 'AI 生成性能监控图' },
      legend: { data: ['CPU', '内存', '响应时间'] },
      tooltip: { trigger: 'axis' },
      grid: { top: 74, left: 24, right: 24, bottom: 24, containLabel: true },
      xAxis: { type: 'category', data: ['10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30'] },
      yAxis: [
        { type: 'value', name: '利用率(%)', min: 0, max: 100 },
        { type: 'value', name: '延迟(ms)', min: 0, max: 400 },
      ],
      series: [
        { name: 'CPU', type: 'line', data: [52, 61, 68, 72, 66, 59, 64], smooth: true },
        { name: '内存', type: 'line', data: [43, 45, 50, 57, 60, 63, 65], smooth: true },
        { name: '响应时间', type: 'bar', yAxisIndex: 1, data: [120, 180, 210, 240, 190, 165, 170] },
      ],
    })
  }

  if (lower.includes('pie') || input.includes('饼')) {
    return beautifyChartOption({
      title: { text: 'AI 生成饼图' },
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: '55%',
          data: [
            { value: 1048, name: '搜索引擎' },
            { value: 735, name: '直达' },
            { value: 580, name: '邮件营销' },
          ],
        },
      ],
    })
  }
  if (lower.includes('radar') || input.includes('雷达')) {
    return beautifyChartOption({
      title: { text: 'AI 生成雷达图' },
      radar: {
        indicator: [
          { name: '性能', max: 100 },
          { name: '可维护性', max: 100 },
          { name: '可扩展性', max: 100 },
          { name: '安全性', max: 100 },
        ],
      },
      series: [{ type: 'radar', data: [{ value: [90, 85, 88, 80], name: '项目评分' }] }],
    })
  }
  if (lower.includes('bar') || input.includes('柱')) {
    return beautifyChartOption({
      title: { text: 'AI 生成柱状图' },
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: [120, 200, 150, 80, 70] }],
    })
  }
  return beautifyChartOption({
    title: { text: 'AI 生成折线图' },
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: true, data: [150, 230, 224, 218, 135] }],
  })
}
