/**
 * 阶段7 WebSocket 私聊连通性自测（全自动）
 * 前置：1) npm run db:init && npm run seed:accounts
 *       2) 服务已启动（npm run start:dev，默认 http://localhost:8080）
 * 用法：node scripts/test-ws.js
 * 流程：
 *   1. 登录 A（20211231245 已认证）与 B（admin）
 *   2. A 发布求购 → B 接单（自动创建会话，验证阶段4对接）
 *   3. 无 token 连接 WS → 期待被拒
 *   4. 双方带 token 连接 → 期待 connected 事件
 *   5. A 走 REST 发消息 → B 期待收到 message:new（一对一推送）
 *   6. B 走 WS message:send 回复 → A 期待收到 message:new，B 收到 ack
 *   7. REST 拉历史验证持久化与已读标记
 */
const { io } = require('socket.io-client');

const BASE = 'http://localhost:8080';
const API = `${BASE}/api/v1`;

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    console.error(`  FAIL ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function login(studentNo, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentNo, password }),
  });
  const json = await res.json();
  if (json.code !== 0) throw new Error(`登录失败 ${studentNo}: ${json.message}`);
  return json.data.token;
}

async function api(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function connect(token) {
  return io(BASE, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  });
}

function waitEvent(socket, event, ms = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`等待 ${event} 超时`)), ms);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('[1] 登录并创建会话（发布求购 → 接单自动建会话）');
  const tokenA = await login('20211231245', 'abc12345'); // 买家（求购者）
  const tokenB = await login('admin', 'admin123'); // 卖家（接单人）

  const want = await api('POST', '/wants', tokenA, {
    itemName: 'WS自测求购-' + Date.now(),
    budget: 20,
  });
  if (want.code !== 0) throw new Error('发布求购失败: ' + want.message);
  const wantId = want.data.id ?? want.data.wantId;
  const accept = await api('POST', `/wants/${wantId}/accept`, tokenB);
  if (accept.code !== 0) throw new Error('接单失败: ' + accept.message);
  const sessionId = accept.data.conversationId;
  check('接单自动创建会话（阶段4对接）', !!sessionId, `sessionId=${sessionId}`);

  console.log('[2] 无 token 连接 WS → 应被拒');
  const anon = connect(null);
  const anonException = await waitEvent(anon, 'exception', 5000).catch(() => null);
  check('匿名连接收到 exception 并断开', !!anonException && anonException.code === 401);
  await sleep(200);

  console.log('[3] 双方带 token 连接 WS');
  const sockA = connect(tokenA);
  const sockB = connect(tokenB);
  const [connA, connB] = await Promise.all([
    waitEvent(sockA, 'connected'),
    waitEvent(sockB, 'connected'),
  ]);
  check('A 连接成功', !!connA && typeof connA.userId === 'number');
  check('B 连接成功', !!connB && typeof connB.userId === 'number');

  console.log('[4] A 走 REST 发消息 → B 应收 message:new（一对一）');
  const waitB = waitEvent(sockB, 'message:new');
  const sent = await api('POST', `/chat/sessions/${sessionId}/messages`, tokenA, {
    content: '你好，求购的东西还在吗？',
  });
  check('REST 发送成功', sent.code === 0 && sent.data.id > 0, `msgId=${sent.data?.id}`);
  const gotB = await waitB.catch((e) => null);
  check(
    'B 收到推送且内容一致',
    !!gotB && gotB.content === '你好，求购的东西还在吗？' && gotB.receiverId === connB.userId,
  );

  console.log('[5] B 走 WS message:send 回复 → A 收推送，B 收 ack');
  const waitA = waitEvent(sockA, 'message:new');
  const ackPromise = new Promise((resolve) =>
    sockB.emit('message:send', { sessionId, content: '还在，明晚东区面交' }, resolve),
  );
  const [gotA, ack] = await Promise.all([waitA.catch(() => null), ackPromise]);
  check('B 收到 ack 且 code=0', !!ack && ack.code === 0 && ack.data.id > 0);
  check('A 收到推送且内容一致', !!gotA && gotA.content === '还在，明晚东区面交');

  console.log('[6] 历史消息与已读标记');
  // B 拉历史 → A 发的消息对 B 来说置为已读
  const histB = await api('GET', `/chat/sessions/${sessionId}/messages?page=1&pageSize=10`, tokenB);
  check('历史消息持久化 2 条', histB.code === 0 && histB.data.total === 2);
  // A 再拉历史 → 自己发的消息应已被 B 读（isRead=true）
  const histA = await api('GET', `/chat/sessions/${sessionId}/messages?page=1&pageSize=10`, tokenA);
  const aMsg = histA.data?.list?.find((m) => m.content === '你好，求购的东西还在吗？');
  check('拉取即已读生效', !!aMsg && aMsg.isRead === true);

  console.log('[7] 会话列表未读数');
  // 注意：[6] 中双方已拉取历史（未读清零），此处 B 新发一条再断言 A 侧未读数
  await api('POST', `/chat/sessions/${sessionId}/messages`, tokenB, {
    content: '补充：带现金或校园卡均可',
  });
  const sessA = await api('GET', '/chat/sessions?page=1&pageSize=10', tokenA);
  const rowA = sessA.data?.list?.find((s) => s.id === sessionId);
  check('A 侧未读数=1（B 新发未拉取）', !!rowA && rowA.unreadCount === 1, `unread=${rowA?.unreadCount}`);
  check('会话含对方摘要与求购摘要', !!rowA && !!rowA.peer?.nickname && !!rowA.want?.itemName);

  console.log('[8] 越权与鉴权');
  const tokenC = await login('20211231246', 'abc12345'); // 第三者
  const hackHist = await api('GET', `/chat/sessions/${sessionId}/messages`, tokenC);
  check('非参与者拉历史 → 403', hackHist.code === 403, `code=${hackHist.code}`);
  const hackSend = await api('POST', `/chat/sessions/${sessionId}/messages`, tokenC, { content: 'hack' });
  check('非参与者发消息 → 403', hackSend.code === 403);
  const noAuth = await api('GET', '/chat/sessions', null);
  check('匿名会话列表 → 401', noAuth.code === 401);

  sockA.close();
  sockB.close();
  anon.close();

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('自测异常终止：', e.message);
  process.exit(1);
});
