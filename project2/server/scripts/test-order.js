/**
 * 阶段8 订单模块自测（全自动）
 * 前置：1) npm run db:init && npm run seed:accounts
 *       2) 服务已启动（npm run start:dev，默认 http://localhost:8080）
 * 用法：node scripts/test-order.js
 * 流程：建在售商品 → 下单 → 状态机（confirm/complete/cancel 全路径 + 非法流转 409）
 *       → complete 联动商品已售出 → 双方/第三者/匿名权限 → 列表与详情摘要
 */

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

const futureTime = () => new Date(Date.now() + 24 * 3600 * 1000).toISOString();
const pastTime = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();

(async () => {
  console.log('[0] 登录三个角色：卖家admin / 买家A(已认证) / 第三者C');
  const tokenSeller = await login('admin', 'admin123');
  const tokenBuyer = await login('20211231245', 'abc12345');
  const tokenThird = await login('20211231246', 'abc12345');

  console.log('[1] 准备在售商品（卖家发布 → 审核通过）');
  const g = await api('POST', '/goods', tokenSeller, {
    title: '订单自测·羽毛球拍-' + Date.now(),
    price: 80,
    categoryId: 4,
    conditionLevel: '几乎全新',
    campus: '北区',
    tradeMethod: '当面交易',
    description: '自测商品',
  });
  check('发布商品', g.code === 0 && (g.data.id ?? g.data.goodsId) > 0);
  const goodsId = g.data.id ?? g.data.goodsId;
  const rv = await api('PATCH', `/admin/goods/${goodsId}/review`, tokenSeller, { result: 'pass' });
  check('审核通过→在售', rv.code === 0);

  console.log('[2] 创建订单异常路径');
  const r401 = await api('POST', '/orders', null, { goodsId, appointmentPlace: '东区' });
  check('匿名下单 → 401', r401.code === 401);
  const rPast = await api('POST', '/orders', tokenBuyer, {
    goodsId, appointmentPlace: '东区图书馆', appointmentTime: pastTime(),
  });
  check('约定时间为过去 → 400', rPast.code === 400, rPast.message);
  const rSelf = await api('POST', '/orders', tokenSeller, { goodsId, appointmentPlace: '东区' });
  check('买自己的商品 → 400', rSelf.code === 400, rSelf.message);
  const r404 = await api('POST', '/orders', tokenBuyer, { goodsId: 99999, appointmentPlace: '东区' });
  check('商品不存在 → 404', r404.code === 404);
  const rNoPlace = await api('POST', '/orders', tokenBuyer, { goodsId, appointmentPlace: '' });
  check('约定地点为空 → 400', rNoPlace.code === 400);

  console.log('[3] 买家正常下单 × 2（同一商品可多条待沟通订单）');
  const o1 = await api('POST', '/orders', tokenBuyer, {
    goodsId, appointmentPlace: '东区图书馆门口', appointmentTime: futureTime(), remark: '当面验货',
  });
  check('订单1创建成功（待沟通）', o1.code === 0 && o1.data.status === '待沟通' && /^XY\d{20}$/.test(o1.data.orderNo), o1.data.orderNo);
  const o2 = await api('POST', '/orders', tokenBuyer, { goodsId, appointmentPlace: '北区操场' });
  check('订单2创建成功', o2.code === 0 && o2.data.status === '待沟通');
  const order1 = o1.data.id;
  const order2 = o2.data.id;

  console.log('[4] 状态机：非法流转 → 409');
  const badComplete = await api('PATCH', `/orders/${order1}/status`, tokenBuyer, { action: 'complete' });
  check('待沟通→complete 拦截', badComplete.code === 409, badComplete.message);
  const badAction = await api('PATCH', `/orders/${order1}/status`, tokenBuyer, { action: 'refund' });
  check('非法 action → 400', badAction.code === 400);

  console.log('[5] 权限：第三者查看/操作 → 403');
  const d403 = await api('GET', `/orders/${order1}`, tokenThird);
  check('第三者查看详情 → 403', d403.code === 403);
  const u403 = await api('PATCH', `/orders/${order1}/status`, tokenThird, { action: 'confirm' });
  check('第三者流转 → 403', u403.code === 403);
  const d404 = await api('GET', `/orders/99999`, tokenBuyer);
  check('订单不存在 → 404', d404.code === 404);

  console.log('[6] 订单1：confirm → complete（联动商品已售出）');
  const c1 = await api('PATCH', `/orders/${order1}/status`, tokenBuyer, { action: 'confirm' });
  check('confirm → 待交易', c1.code === 0 && c1.data.status === '待交易');
  const cmp1 = await api('PATCH', `/orders/${order1}/status`, tokenSeller, { action: 'complete' });
  check('complete → 已完成', cmp1.code === 0 && cmp1.data.status === '已完成');
  const goodsAfter = await api('GET', `/goods/my?page=1&pageSize=50`, tokenSeller);
  const gAfter = goodsAfter.data?.list?.find((x) => x.id === goodsId);
  check('商品联动置为已售出', !!gAfter && gAfter.status === '已售出', `status=${gAfter?.status}`);
  const cancelAfterDone = await api('PATCH', `/orders/${order1}/status`, tokenBuyer, { action: 'cancel' });
  check('已完成（终态）再 cancel → 409', cancelAfterDone.code === 409);

  console.log('[7] 订单2：cancel → 已取消（终态拦截）');
  const c2 = await api('PATCH', `/orders/${order2}/status`, tokenSeller, { action: 'cancel' });
  check('cancel → 已取消', c2.code === 0 && c2.data.status === '已取消');
  const reConfirm = await api('PATCH', `/orders/${order2}/status`, tokenBuyer, { action: 'confirm' });
  check('已取消（终态）再 confirm → 409', reConfirm.code === 409);

  console.log('[8] 商品已售出后再下单 → 409');
  const o3 = await api('POST', '/orders', tokenBuyer, { goodsId, appointmentPlace: '东区' });
  check('非在售商品下单拦截', o3.code === 409, o3.message);

  console.log('[9] 列表与详情');
  const buyList = await api('GET', '/orders?role=buy&page=1&pageSize=10', tokenBuyer);
  check('买家「我的买到」2 条', buyList.code === 0 && buyList.data.total === 2, `total=${buyList.data?.total}`);
  const sellList = await api('GET', '/orders?role=sell&page=1&pageSize=10', tokenSeller);
  check('卖家「我的卖出」2 条', sellList.code === 0 && sellList.data.total === 2);
  const doneList = await api('GET', '/orders?role=buy&status=' + encodeURIComponent('已完成'), tokenBuyer);
  check('状态筛选（已完成）1 条', doneList.code === 0 && doneList.data.total === 1);
  const row = buyList.data?.list?.find((o) => o.id === order1);
  check('列表含商品/对方摘要', !!row && row.goods?.title?.includes('羽毛球拍') && !!row.peer?.nickname && !!row.seller?.nickname);
  const detail = await api('GET', `/orders/${order1}`, tokenBuyer);
  check('详情含约定信息', detail.code === 0 && detail.data.appointmentPlace === '东区图书馆门口' && !!detail.data.appointmentTime);
  const badStatus = await api('GET', '/orders?role=buy&status=' + encodeURIComponent('进行中'), tokenBuyer);
  check('非法状态筛选 → 400', badStatus.code === 400);

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('自测异常终止：', e.message);
  process.exit(1);
});
