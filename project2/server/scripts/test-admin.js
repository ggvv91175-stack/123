/**
 * 阶段9 举报模块 + 管理员后台 自测（全自动）
 * 前置：1) npm run db:init && npm run seed:accounts
 *       2) 服务已启动（npm run start:dev，默认 http://localhost:8080）
 * 用法：node scripts/test-admin.js
 * 覆盖：举报提交（多态校验/去重409/自举报400）/ 管理员列表 / 处理联动
 *       （下架商品→违规下架 / 封禁用户→Token全失效 / 删除留言 / 驳回）
 *       用户管理（列表/禁用/解禁/保护admin）/ 数据看板 / 全部 admin 接口权限 403
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
  return json;
}

async function mustLogin(studentNo, password) {
  const json = await login(studentNo, password);
  if (json.code !== 0) throw new Error(`登录失败 ${studentNo}: ${json.message}`);
  return json.data;
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

(async () => {
  console.log('[0] 登录：admin / A(20211231245 已认证) / B(20211231246)');
  const admin = await mustLogin('admin', 'admin123');
  const A = await mustLogin('20211231245', 'abc12345');
  const B = await mustLogin('20211231246', 'abc12345');

  console.log('[1] 准备：A 发布商品1（在售）+ 发布求购');
  const g1 = await api('POST', '/goods', A.token, {
    title: '举报自测·电风扇-' + Date.now(),
    price: 35, categoryId: 3, conditionLevel: '轻微使用',
    campus: '南区', tradeMethod: '宿舍自提', description: '自测商品1',
  });
  const goodsId = g1.data.id ?? g1.data.goodsId;
  await api('PATCH', `/admin/goods/${goodsId}/review`, admin.token, { result: 'pass' });
  const w = await api('POST', '/wants', A.token, { itemName: '求购插线板-' + Date.now(), budget: 10 });
  const wantId = w.data.id ?? w.data.wantId;
  check('准备商品与求购', goodsId > 0 && wantId > 0, `goods=${goodsId} want=${wantId}`);

  console.log('[2] 用户举报');
  const r1 = await api('POST', '/reports', B.token, { targetType: '商品', targetId: goodsId, reason: '图片与实物不符，疑似诈骗' });
  check('举报商品成功（待处理）', r1.code === 0 && r1.data.status === '待处理');
  const reportGoods = r1.data.id;
  const rDup = await api('POST', '/reports', B.token, { targetType: '商品', targetId: goodsId, reason: '重复举报' });
  check('重复待处理举报 → 409', rDup.code === 409, rDup.message);
  const r404 = await api('POST', '/reports', B.token, { targetType: '商品', targetId: 99999, reason: '不存在' });
  check('举报不存在商品 → 404', r404.code === 404);
  const rSelf = await api('POST', '/reports', A.token, { targetType: '商品', targetId: goodsId, reason: '自己的' });
  check('举报自己内容 → 400', rSelf.code === 400, rSelf.message);
  const r401 = await api('POST', '/reports', null, { targetType: '商品', targetId: goodsId, reason: '匿名' });
  check('匿名举报 → 401', r401.code === 401);
  const rBadType = await api('POST', '/reports', B.token, { targetType: '订单', targetId: 1, reason: '非法类型' });
  check('非法目标类型 → 400', rBadType.code === 400);
  const r2 = await api('POST', '/reports', B.token, { targetType: '求购', targetId: wantId, reason: '恶意求购骚扰' });
  check('举报求购成功', r2.code === 0);
  const reportWant = r2.data.id;
  const r3 = await api('POST', '/reports', B.token, { targetType: '用户', targetId: A.user.id, reason: '发布违规信息' });
  check('举报用户成功', r3.code === 0);
  const reportUser = r3.data.id;

  console.log('[3] admin 接口权限加固（学生访问一律 403）');
  const s1 = await api('GET', '/admin/reports', B.token);
  const s2 = await api('PATCH', `/admin/reports/${reportGoods}/handle`, B.token, { action: '驳回举报', result: 'x' });
  const s3 = await api('GET', '/admin/users', B.token);
  const s4 = await api('PATCH', `/admin/users/${A.user.id}/status`, B.token, { action: 'disable' });
  const s5 = await api('GET', '/admin/dashboard/stats', B.token);
  check('学生访问 5 个 admin 接口全 403', [s1, s2, s3, s4, s5].every((x) => x.code === 403));

  console.log('[4] 管理员举报列表');
  const list = await api('GET', '/admin/reports?page=1&pageSize=10', admin.token);
  check('待处理列表 ≥3 且含举报人摘要', list.code === 0 && list.data.total >= 3 && !!list.data.list[0].reporter?.nickname, `total=${list.data?.total}`);
  const listFiltered = await api('GET', '/admin/reports?targetType=' + encodeURIComponent('求购'), admin.token);
  check('按类型筛选（求购）1 条', listFiltered.code === 0 && listFiltered.data.total === 1);

  console.log('[5] 处理举报：商品下架联动');
  const badAction = await api('PATCH', `/admin/reports/${reportGoods}/handle`, admin.token, { action: '封禁用户' });
  check('动作与类型不匹配 → 400', badAction.code === 400, badAction.message);
  const h1 = await api('PATCH', `/admin/reports/${reportGoods}/handle`, admin.token, { action: '下架商品', result: '经核实存在虚假宣传' });
  check('下架商品 → 已处理', h1.code === 0 && h1.data.status === '已处理');
  const myGoods = await api('GET', '/goods/my?page=1&pageSize=50', A.token);
  const g1After = myGoods.data?.list?.find((x) => x.id === goodsId);
  check('商品联动违规下架', !!g1After && g1After.status === '违规下架', `status=${g1After?.status}`);
  const hDup = await api('PATCH', `/admin/reports/${reportGoods}/handle`, admin.token, { action: '下架商品' });
  check('重复处理 → 409', hDup.code === 409);

  console.log('[6] 处理举报：驳回');
  const hBadReject = await api('PATCH', `/admin/reports/${reportWant}/handle`, admin.token, { action: '驳回举报' });
  check('驳回无说明 → 400', hBadReject.code === 400, hBadReject.message);
  const h2 = await api('PATCH', `/admin/reports/${reportWant}/handle`, admin.token, { action: '驳回举报', result: '经核实为正常求购' });
  check('驳回举报 → 已驳回', h2.code === 0 && h2.data.status === '已驳回');

  console.log('[7] 封禁用户联动：Token 全量失效 + 解禁恢复');
  const h3 = await api('PATCH', `/admin/reports/${reportUser}/handle`, admin.token, { action: '封禁用户', result: '多次违规' });
  check('封禁用户 → 已处理', h3.code === 0);
  const meAfterBan = await api('GET', '/users/me', A.token);
  check('被封禁用户旧 Token → 401', meAfterBan.code === 401);
  const relogin = await login('20211231245', 'abc12345');
  check('被封禁用户登录 → 403', relogin.code === 403, relogin.message);
  const enable = await api('PATCH', `/admin/users/${A.user.id}/status`, admin.token, { action: 'enable' });
  check('解禁账号', enable.code === 0 && enable.data.status === '正常');
  const relogin2 = await mustLogin('20211231245', 'abc12345');
  check('解禁后重新登录成功', !!relogin2.token);
  A.token = relogin2.token;

  console.log('[8] 用户管理');
  const ulist = await api('GET', '/admin/users?keyword=2021123&page=1&pageSize=10', admin.token);
  check('用户列表关键词命中 2 名学生', ulist.code === 0 && ulist.data.total === 2, `total=${ulist.data?.total}`);
  check('列表不含 passwordHash', ulist.code === 0 && ulist.data.list.every((u) => !('passwordHash' in u)));
  const disB = await api('PATCH', `/admin/users/${B.user.id}/status`, admin.token, { action: 'disable' });
  check('禁用 B', disB.code === 0 && disB.data.status === '禁用');
  const bMe = await api('GET', '/users/me', B.token);
  check('B 旧 Token 失效 → 401', bMe.code === 401);
  const disB2 = await api('PATCH', `/admin/users/${B.user.id}/status`, admin.token, { action: 'disable' });
  check('重复禁用 → 409', disB2.code === 409);
  const disAdmin = await api('PATCH', `/admin/users/${admin.user.id}/status`, admin.token, { action: 'disable' });
  check('禁用管理员 → 400', disAdmin.code === 400, disAdmin.message);
  const enB = await api('PATCH', `/admin/users/${B.user.id}/status`, admin.token, { action: 'enable' });
  check('解禁 B', enB.code === 0 && enB.data.status === '正常');
  const bRelogin = await mustLogin('20211231246', 'abc12345');
  B.token = bRelogin.token;

  console.log('[9] 留言举报：删除留言联动');
  const g2 = await api('POST', '/goods', A.token, {
    title: '举报自测·台灯-' + Date.now(),
    price: 15, categoryId: 3, conditionLevel: '几乎全新',
    campus: '西区', tradeMethod: '当面交易', description: '自测商品2',
  });
  const goodsId2 = g2.data.id ?? g2.data.goodsId;
  await api('PATCH', `/admin/goods/${goodsId2}/review`, admin.token, { result: 'pass' });
  const cmt = await api('POST', `/goods/${goodsId2}/comments`, B.token, { content: '违规广告留言' });
  check('B 留言成功', cmt.code === 0 && cmt.data.id > 0);
  const r4 = await api('POST', '/reports', A.token, { targetType: '留言', targetId: cmt.data.id, reason: '垃圾广告' });
  check('举报留言成功', r4.code === 0);
  const h4 = await api('PATCH', `/admin/reports/${r4.data.id}/handle`, admin.token, { action: '删除留言', result: '属实' });
  check('删除留言 → 已处理', h4.code === 0);
  const cmtList = await api('GET', `/goods/${goodsId2}/comments?page=1&pageSize=10`, null);
  check('留言列表已不可见（软删除）', cmtList.code === 0 && cmtList.data.total === 0);

  console.log('[10] 数据看板');
  const stats = await api('GET', '/admin/dashboard/stats', admin.token);
  const d = stats.data ?? {};
  check(
    '看板字段齐备且计数正确',
    stats.code === 0 && d.userTotal >= 3 && d.goodsTotal >= 2 && d.wantTotal >= 1 &&
      typeof d.goodsOnSale === 'number' && typeof d.wantOpen === 'number' &&
      d.pending && typeof d.pending.certifications === 'number' &&
      typeof d.pending.goods === 'number' && typeof d.pending.reports === 'number',
    JSON.stringify(d),
  );

  console.log(`\n结果：${passed} 通过，${failed} 失败`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('自测异常终止：', e.message);
  process.exit(1);
});
