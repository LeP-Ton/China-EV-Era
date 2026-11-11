import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { BRAND_LOGOS, DEFAULT_BRAND_LOGO, createGame } from '../src/engine';
import { SAVE_KEYS, parseGame, serializeGame } from '../src/persistence';

mkdirSync('.local/qa/branding', { recursive: true });

async function storedLogo(page: Page) {
  return page.evaluate((key) => {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(JSON.parse(text).data).setup.logo : null;
  }, SAVE_KEYS.auto);
}
async function saveCenter(page: Page) {
  await page.getByRole('button', { name: '打开存档中心', exact: true }).click();
}
async function research(page: Page) {
  if (await page.getByRole('button', { name: '打开导航' }).isVisible())
    await page.getByRole('button', { name: '打开导航' }).click();
  await page
    .locator('.sidebar nav')
    .getByRole('button', { name: '车型与技术研发', exact: true })
    .click();
}

for (const width of [1440, 390]) {
  test('车标选择与图片、存档同步：' + width + 'px', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('./');
    await page.getByRole('radio', { name: '星芒', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: '山岳', exact: true })).toBeChecked();
    await expect(page.locator('.car-render')).toHaveAttribute('data-logo', 'summit');
    const shapes = new Set<string>();
    for (const logo of BRAND_LOGOS) {
      await page.locator('.logo-option').filter({ hasText: logo.name }).click();
      await expect(page.getByRole('radio', { name: logo.name, exact: true })).toBeChecked();
      await expect(page.locator('.car-render')).toHaveAttribute('data-logo', logo.id);
      shapes.add((await page.locator('.car-emblem-face path').getAttribute('d'))!);
    }
    expect(shapes.size).toBe(BRAND_LOGOS.length);
    await page.locator('.logo-option').filter({ hasText: '凌翼' }).click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '.local/qa/branding/create-' + width + '.png', fullPage: true });
    await page.getByRole('button', { name: '进入 CEO 经营桌面' }).click();
    await expect.poll(() => storedLogo(page)).toBe('wings');
    await expect(page.locator('.car-render')).toHaveAttribute('data-logo', 'wings');
    await expect(page.locator('.company-switch svg')).toHaveAttribute('data-logo', 'wings');
    await saveCenter(page);
    await page.getByRole('button', { name: /保存手动快照/ }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /导出存档文件/ }).click(),
    ]);
    expect(parseGame(await readFile((await download.path())!, 'utf8')).setup.logo).toBe('wings');
    await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
    await research(page);
    await expect(page.locator('.car-render')).toHaveAttribute('data-logo', 'wings');
    await page.screenshot({
      path: '.local/qa/branding/research-' + width + '.png',
      fullPage: true,
    });
    await page.reload();
    await expect(page.locator('.car-render')).toHaveAttribute('data-logo', 'wings');
    const legacy = createGame({
      name: '旧车标存档',
      brand: '旧品牌',
      model: '旧车型',
      strategy: 'quality',
      seed: 'GAMEX-2026',
    });
    delete legacy.setup.logo;
    await saveCenter(page);
    await page.locator('input[type=file]').setInputFiles({
      name: 'legacy.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serializeGame(legacy)),
    });
    await expect.poll(() => storedLogo(page)).toBe(DEFAULT_BRAND_LOGO);
    await expect(page.locator('.car-render')).toHaveAttribute('data-logo', DEFAULT_BRAND_LOGO);
    await saveCenter(page);
    await page.getByRole('button', { name: /载入手动快照/ }).click();
    await expect.poll(() => storedLogo(page)).toBe('wings');
    await expect(page.locator('.car-render')).toHaveAttribute('data-logo', 'wings');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await saveCenter(page);
    await page.getByRole('button', { name: '重新开始', exact: true }).click();
    await expect(page.getByRole('radio', { name: '凌翼', exact: true })).toBeChecked();
    await expect(page.locator('.car-render')).toHaveAttribute('data-logo', 'wings');
    await page.getByRole('button', { name: '取消重新开始', exact: true }).click();
    await expect(page.locator('.car-render')).toHaveAttribute('data-logo', 'wings');
    expect(errors).toEqual([]);
  });
}
