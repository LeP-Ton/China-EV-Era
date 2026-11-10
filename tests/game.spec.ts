import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { advanceWeek, applyCommand, createGame, type Command, type GameState } from '../src/engine';
import { serializeGame } from '../src/persistence';

mkdirSync('.local/qa', { recursive: true });
async function readState(page: Page): Promise<GameState> {
  return page.evaluate(() =>
    JSON.parse(JSON.parse(localStorage.getItem('gamex-nev-v1-auto')!).data),
  );
}
async function syncedState(page: Page): Promise<GameState> {
  const week = Number(await page.locator('.app-shell').getAttribute('data-week'));
  await expect.poll(async () => (await readState(page))?.week).toBe(week);
  return readState(page);
}
async function closeModal(page: Page) {
  if (await page.getByRole('dialog').count())
    await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
}
async function nav(page: Page, name: string) {
  if (await page.getByRole('button', { name: '打开导航' }).isVisible())
    await page.getByRole('button', { name: '打开导航' }).click();
  await page.locator('.sidebar nav').getByRole('button', { name, exact: true }).click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test('真实游玩：创建、研发、资本、办公、存读档、十二季度与复盘', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('企业名称', { exact: true }).fill('初航汽车科技');
  await page.getByLabel('汽车品牌', { exact: true }).fill('初航');
  await page.getByLabel('首款车型', { exact: true }).fill('初航 ONE');
  await page.getByLabel(/市场随机种子/).fill('BROWSER-2026');
  await page.getByRole('button', { name: '进入 CEO 经营桌面' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('经营驾驶舱');
  await noOverflow(page);
  await page.getByRole('button', { name: '配置经营计划', exact: true }).click();
  await page.getByLabel(/研发预算/).fill('1.8');
  await page.getByLabel(/质量投入/).fill('0.45');
  await page.getByLabel(/季度生产目标/).fill('13000');
  await page.getByRole('button', { name: '应用经营计划' }).click();
  await nav(page, '车型与技术研发');
  await page.getByLabel('车型名称', { exact: true }).fill('初航 01');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: '启动车型研发' }).click();
  await expect.poll(async () => (await readState(page))?.product.status).toBe('developing');
  expect((await readState(page)).product.name).toBe('初航 01');
  await page.screenshot({ path: '.local/qa/research.png', fullPage: true });
  await nav(page, '财务与资本');
  const cash = (await readState(page)).company.cash;
  await page.getByRole('button', { name: '贷款 3 亿元', exact: true }).click();
  await expect.poll(async () => (await readState(page)).company.debt).toBe(300);
  expect((await readState(page)).company.cash).toBe(cash + 300);
  await page.getByRole('button', { name: '融资 3 亿元', exact: true }).click();
  await expect.poll(async () => (await readState(page)).company.ownership).toBeLessThan(1);
  expect((await readState(page)).period.revenue).toBe(0);
  await nav(page, '企业办公通信');
  await page.getByRole('button', { name: /要求补充报告/ }).click();
  await expect.poll(async () => (await readState(page)).attention.available).toBe(9);
  await page.getByRole('checkbox').first().uncheck();
  await expect.poll(async () => (await readState(page)).executives[0].autonomous).toBe(false);
  await page.getByRole('button', { name: '存档中心', exact: true }).click();
  await page.getByRole('button', { name: /保存手动快照/ }).click();
  await closeModal(page);
  const snapshot = await readState(page);
  await page.getByRole('button', { name: '单周推进', exact: true }).click();
  await expect.poll(async () => (await readState(page)).week).toBe(1);
  await page.getByRole('button', { name: '存档中心', exact: true }).click();
  await page.getByRole('button', { name: /载入手动快照/ }).click();
  await expect.poll(async () => (await readState(page)).week).toBe(0);
  expect((await readState(page)).company.cash).toBe(snapshot.company.cash);
  let captured = false;
  for (let i = 0; i < 35; i++) {
    const before = await syncedState(page);
    if (before.status !== 'active') break;
    await closeModal(page);
    if (before.product.status === 'ready') {
      await nav(page, '车型与技术研发');
      await page.getByRole('button', { name: '以当前验证度批准上市', exact: true }).click();
      await expect.poll(async () => (await readState(page)).product.status).toBe('selling');
    }
    if (!captured && before.week >= 39) {
      await nav(page, 'CEO 经营驾驶舱');
      await page.screenshot({ path: '.local/qa/dashboard-running.png', fullPage: true });
      captured = true;
    }
    await page.getByRole('button', { name: '快速推进至季末', exact: true }).click();
    await expect(page.getByText('自动运营中', { exact: true })).toBeVisible();
    await expect(page.getByText('自动运营中', { exact: true })).toHaveCount(0, { timeout: 20000 });
    await expect.poll(async () => (await readState(page)).week).toBeGreaterThan(before.week);
  }
  const end = await syncedState(page);
  expect(end.status).toBe('completed');
  expect(end.week).toBe(156);
  expect(end.reports.length).toBe(12);
  expect(end.product.totalDelivered).toBeGreaterThan(10000);
  expect(end.company.totalRevenue).toBeGreaterThan(1000);
  await expect(page.getByRole('dialog')).toContainText('完成 12 季度经营');
  await page.screenshot({ path: '.local/qa/outcome.png', fullPage: true });
  await closeModal(page);
  await page.getByRole('button', { name: '企业历史与复盘', exact: true }).click();
  await page.getByRole('button', { name: '校验种子复盘' }).click();
  await expect(page.getByRole('status')).toContainText('复盘一致');
  await closeModal(page);
  await nav(page, '财务与资本');
  await noOverflow(page);
  await page.screenshot({ path: '.local/qa/finance.png', fullPage: true });
  await nav(page, '舆论与市场');
  await noOverflow(page);
  await page.screenshot({ path: '.local/qa/market.png', fullPage: true });
  expect(errors).toEqual([]);
});

function crisisFixture(): GameState {
  let s = createGame({
    name: '危机验收企业',
    brand: '测试',
    model: '速成 ONE',
    strategy: 'value',
    seed: 'RISK-2026',
  });
  const command = (action: Command) => {
    const result = applyCommand(s, action);
    if (!result.ok) throw new Error(result.message);
    s = result.state;
  };
  command({ type: 'executive', id: 'cto', autonomous: false });
  command({ type: 'executive', id: 'coo', autonomous: false, goal: 'growth' });
  command({ type: 'plan', values: { research: 180, quality: 0 } });
  command({ type: 'supplier', supplier: 'unverified' });
  command({ type: 'develop', mode: 'rushed' });
  while (s.product.status !== 'ready' && s.week < 40) s = advanceWeek(s);
  command({ type: 'launch' });
  while (s.cases.length === 0 && s.week < 80) s = advanceWeek(s);
  if (!s.cases.length) throw new Error('危机验收样本未形成真实质量事件');
  return s;
}

test('真实危机：导入可复现事故、调查、报告、召回及损坏存档保护', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '进入 CEO 经营桌面' }).click();
  await page.getByRole('button', { name: '存档中心', exact: true }).click();
  const fixture = crisisFixture();
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'crisis.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serializeGame(fixture)),
    });
  await expect.poll(async () => (await readState(page)).company.name).toBe('危机验收企业');
  await nav(page, '生产与供应链');
  await expect(page.getByText('质量异常待处置', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: '.local/qa/quality-warning.png', fullPage: true });
  await page.getByRole('button', { name: /^专项调查/ }).click();
  await expect.poll(async () => (await readState(page)).cases[0].evidence).toBe(95);
  await page.getByRole('button', { name: '发布进展与报告', exact: true }).click();
  await expect.poll(async () => (await readState(page)).cases[0].reported).toBe(true);
  const cash = (await readState(page)).company.cash;
  await page.getByRole('button', { name: /启动召回/ }).click();
  await expect.poll(async () => (await readState(page)).cases[0].status).toBe('closed');
  const recalled = await readState(page);
  expect(recalled.company.cash).toBeLessThan(cash);
  expect(recalled.batches.every((b) => b.repaired)).toBe(true);
  await page.screenshot({ path: '.local/qa/quality-recalled.png', fullPage: true });
  await page.getByRole('button', { name: '存档中心', exact: true }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{bad'),
    });
  await expect(page.getByRole('status')).toContainText('不是有效的 JSON');
  expect((await readState(page)).company.cash).toBe(recalled.company.cash);
  expect((await readState(page)).cases[0].status).toBe('closed');
});

test('小屏布局：创建与六个管理模块可操作，没有页面横向溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await noOverflow(page);
  await page.getByRole('button', { name: '进入 CEO 经营桌面' }).click();
  for (const name of [
    '车型与技术研发',
    '生产与供应链',
    '财务与资本',
    '舆论与市场',
    '企业办公通信',
    'CEO 经营驾驶舱',
  ]) {
    await nav(page, name);
    await noOverflow(page);
  }
  await page.screenshot({ path: '.local/qa/mobile.png', fullPage: true });
});
