// TODO-004 verifier 用の確認スクリプト。
// 使い方: node verify-pages.mjs <base URL>  例: node verify-pages.mjs http://localhost:4321/ytInvaders/
import { chromium } from 'playwright';

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('usage: node verify-pages.mjs <base URL>');
  process.exit(1);
}

const noBaseUrl = new URL('/', baseUrl).toString();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const badResponses = [];
const consoleErrors = [];
const pageErrors = [];

page.on('response', (res) => {
  if (res.status() >= 400) {
    badResponses.push(`${res.status()} ${res.url()}`);
  }
});
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => {
  pageErrors.push(String(err));
});

console.log(`--- open ${baseUrl} ---`);
await page.goto(baseUrl, { waitUntil: 'networkidle' });

console.log('bad responses (base):', badResponses.length);
badResponses.forEach((l) => console.log(' ', l));
console.log('console errors:', consoleErrors.length);
consoleErrors.forEach((l) => console.log(' ', l));
console.log('pageerrors:', pageErrors.length);
pageErrors.forEach((l) => console.log(' ', l));

await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
const shotPath = process.env.HOME + '/tmp/playwright-mcp/todo004-pages.png';
await page.screenshot({ path: shotPath });
console.log('screenshot:', shotPath);

console.log(`--- open ${noBaseUrl} (base なし) ---`);
const res2 = await page.goto(noBaseUrl, { waitUntil: 'networkidle' }).catch((e) => {
  console.log('goto error:', String(e));
  return null;
});
if (res2) console.log('status (no base):', res2.status());

await browser.close();
