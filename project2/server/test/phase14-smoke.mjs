/**
 * 阶段14：全链路联调脚本（Node.js 内置 fetch，UTF-8 无编码问题）
 * 链路：注册→实名→管理员审核→发布商品→审核→搜索→留言→回复→私聊→订单→完成→求购接单→举报
 * 运行：node test/phase14-smoke.mjs
 */
const base = 'http://localhost:8080/api/v1'
const rand = Math.floor(Math.random() * 900000) + 100000
const noA = `2026${rand}`
let pass = 0
let fail = 0

async function api(method, path, { token, body } = {}) {
  const resp = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json || json.code !== 0) {
    throw new Error(`${resp.status} ${json?.message ?? 'request failed'}`)
  }
  return json.data
}

async function step(name, fn) {
  try {
    const r = await fn()
    pass++
    console.log(`PASS  ${name} -> ${r}`)
  } catch (e) {
    fail++
    console.log(`FAIL  ${name} -> ${e.message}`)
  }
}

// 1. 注册 + 登录 A
await step('01 register A', async () => {
  await api('POST', '/auth/register', { body: { studentNo: noA, password: 'abc12345', nickname: 'chain-test-a' } })
  return `studentNo=${noA}`
})
const loginA = await api('POST', '/auth/login', { body: { studentNo: noA, password: 'abc12345' } })
const tokenA = loginA.token
console.log('PASS  01b login A')

// 2. A 提交实名认证
await step('02 A submit cert', async () => {
  await api('POST', '/users/me/certification', { token: tokenA, body: { studentNo: noA, college: '计算机学院', proofImages: ['https://example.com/proof.jpg'] } })
  return 'submitted'
})

// 3. 管理员审核实名
const admin = await api('POST', '/auth/login', { body: { studentNo: 'admin', password: 'admin123' } })
const tokenAdmin = admin.token
await step('03 admin pass cert', async () => {
  const certs = await api('GET', `/admin/certifications?status=${encodeURIComponent('待审核')}&pageSize=50`, { token: tokenAdmin })
  const cert = certs.list.find((c) => c.studentNo === noA)
  if (!cert) throw new Error(`cert not found for ${noA}`)
  await api('PATCH', `/admin/certifications/${cert.id}/review`, { token: tokenAdmin, body: { result: 'pass' } })
  return `certId=${cert.id} passed`
})

// 4. A 发布商品
let goodsId
await step('04 A publish goods', async () => {
  const g = await api('POST', '/goods', {
    token: tokenA,
    body: { title: '链路测试-高等数学课本', price: 15.5, categoryId: 1, conditionLevel: '轻微使用', campus: '东区', tradeMethod: '当面交易', description: 'phase14 chain test goods', images: [] },
  })
  goodsId = g.id
  return `goodsId=${goodsId} (pending)`
})

// 5. 管理员审核商品
await step('05 admin pass goods', async () => {
  await api('PATCH', `/admin/goods/${goodsId}/review`, { token: tokenAdmin, body: { result: 'pass' } })
  return `goods ${goodsId} on sale`
})

// 6. 搜索浏览（公开）
await step('06 keyword search hit', async () => {
  const s = await api('GET', `/goods?keyword=${encodeURIComponent('高等数学')}`)
  if (s.list.some((g) => g.id === goodsId)) return `hit goodsId=${goodsId}`
  throw new Error('search miss')
})
await step('06b price range filter', async () => {
  const s = await api('GET', '/goods?minPrice=10&maxPrice=20')
  if (s.list.some((g) => g.id === goodsId)) return 'filter hit'
  throw new Error('filter miss')
})

// 7. B 登录 → 详情 → 留言
const loginB = await api('POST', '/auth/login', { body: { studentNo: '20211231245', password: 'abc12345' } })
const tokenB = loginB.token
await step('07 B view detail', async () => {
  const d = await api('GET', `/goods/${goodsId}`, { token: tokenB })
  return `status=${d.status}`
})
let commentId
await step('08 B comment', async () => {
  const c = await api('POST', `/goods/${goodsId}/comments`, { token: tokenB, body: { content: '这本书还在吗？' } })
  commentId = c.id
  return `commentId=${commentId}`
})
await step('09 A reply', async () => {
  const r = await api('POST', `/comments/${commentId}/replies`, { token: tokenA, body: { content: '还在的，随时可交易' } })
  return `replyId=${r.id}`
})

// 10. B 私聊 + 发消息
let sessionId
await step('10 B create chat session', async () => {
  const s = await api('POST', '/chat/sessions', { token: tokenB, body: { goodsId } })
  sessionId = s.conversationId
  return `sessionId=${sessionId}`
})
await step('11 B send msg (REST)', async () => {
  const m = await api('POST', `/chat/sessions/${sessionId}/messages`, { token: tokenB, body: { content: '明天中午东区食堂门口交易可以吗？' } })
  return `msgId=${m.id}`
})
await step('12 A fetch history', async () => {
  const h = await api('GET', `/chat/sessions/${sessionId}/messages`, { token: tokenA })
  if (h.total >= 1) return `history ${h.total} msgs`
  throw new Error('A got no message')
})

// 13. B 创建订单 → 确认 → 完成
let orderId
await step('13 B create order', async () => {
  const o = await api('POST', '/orders', { token: tokenB, body: { goodsId, appointmentPlace: '东区食堂门口', remark: '链路测试订单' } })
  orderId = o.id
  return `orderId=${orderId} orderNo=${o.orderNo}`
})
await step('14 confirm order', async () => {
  await api('PATCH', `/orders/${orderId}/status`, { token: tokenB, body: { action: 'confirm' } })
  return 'confirmed'
})
await step('15 complete order', async () => {
  const r = await api('PATCH', `/orders/${orderId}/status`, { token: tokenB, body: { action: 'complete' } })
  return `status=${r.status}`
})
await step('15b goods marked sold', async () => {
  // 非在售商品详情仅发布者/管理员可见（阶段3安全设计），用卖家 token 查
  const d = await api('GET', `/goods/${goodsId}`, { token: tokenA })
  if (d.status === '已售出') return 'sold'
  throw new Error(`goods status=${d.status}, expect 已售出`)
})

// 16. 求购链路：A 发布求购 → B 接单 → 自动会话
let wantId
await step('16 A publish want', async () => {
  const w = await api('POST', '/wants', { token: tokenA, body: { itemName: '链路测试-求购充电宝', budget: 30, campus: '东区', remark: '急用' } })
  wantId = w.id
  return `wantId=${wantId}`
})
await step('17 B accept want (auto session)', async () => {
  const a = await api('POST', `/wants/${wantId}/accept`, { token: tokenB })
  return `conversationId=${a.conversationId}`
})

// 18. 举报链路：B 举报 → admin 驳回
let reportId
await step('18 B report want', async () => {
  const rp = await api('POST', '/reports', { token: tokenB, body: { targetType: '求购', targetId: wantId, reason: '链路测试举报' } })
  reportId = rp.id
  return `reportId=${reportId}`
})
await step('19 admin reject report', async () => {
  await api('PATCH', `/admin/reports/${reportId}/handle`, { token: tokenAdmin, body: { action: '驳回举报', result: '链路测试：举报不成立' } })
  return 'rejected'
})

console.log('')
console.log(`===== SUMMARY: PASS=${pass} FAIL=${fail} =====`)
process.exit(fail > 0 ? 1 : 0)
