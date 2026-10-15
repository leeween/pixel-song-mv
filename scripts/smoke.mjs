// End-to-end checks use only the generated original demo, never demo/*.mp4.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.join(root, 'output', `qa-${Date.now()}`);
const python = process.env.PYTHON || (process.platform === 'win32' ? path.join(root, '.venv', 'Scripts', 'python.exe') : 'python');
function run(exe, args, expected = 0, env = process.env) {
  const result = spawnSync(exe, args, { cwd: root, env, encoding: 'utf8', timeout: 180000 });
  assert.ifError(result.error);
  assert.equal(result.status, expected, `${exe} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
  return `${result.stdout}\n${result.stderr}`;
}
run(python, ['scripts/create_example.py', '--out', project]);
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const format of ['landscape', 'portrait']) {
    writeFileSync(path.join(project, 'config.js'), `window.MV_CONFIG = { format: '${format}', script: 'sc', audio: 'song.wav' };\n`);
    await page.goto(pathToFileURL(path.join(project, 'index.html')).href + '?t=2');
    await page.waitForFunction(() => document.getElementById('audio').readyState >= 2);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('#screen').getAttribute('width'), format === 'landscape' ? '960' : '540');
    await page.locator('#play').click();
    await page.waitForFunction(() => !document.getElementById('audio').paused && document.getElementById('audio').currentTime > 2);
    await page.locator('#play').click();
    await page.locator('#secs button').nth(3).click();
    await page.waitForFunction(() => Math.abs(document.getElementById('audio').currentTime - 6) < .1);
    await page.locator('#seek').evaluate(el => { el.value = '8'; el.dispatchEvent(new Event('input')); });
    await page.waitForFunction(() => Math.abs(document.getElementById('audio').currentTime - 8) < .1);
    // Stop the live preview loop before time-controlled visual checks.
    await page.goto(pathToFileURL(path.join(project, 'index.html')).href + '?render');
    await page.evaluate(() => document.fonts.ready);
    const frames = new Set();
    for (const t of [1, 3, 5, 7, 9]) {
      await page.evaluate(t => window.renderAt(t), t);
      frames.add(await page.locator('#screen').evaluate(el => el.toDataURL()));
      await page.locator('#screen').screenshot({ path: path.join(project, `${format}-${t}.png`) });
    }
    assert.equal(frames.size, 5, 'Different story events must produce different frames');
    // Actual 30fps video with audio; fully decode to catch a broken or truncated export.
    run(process.execPath, ['assets/render.mjs', '--project', project, '--start', '6', '--end', '7', '--out', `${format}.mp4`]);
    const info = run(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-v', 'info', '-i', path.join(project, `${format}.mp4`), '-f', 'null', '-']);
    assert.match(info, format === 'landscape' ? /1920x1080/ : /1080x1920/);
    assert.match(info, /30 fps/);
    assert.match(info, /Audio: aac/);
    console.log(`PASS ${format}: playback, seeking, 5 stills, 30fps export and full decode`);
  }
  assert.deepEqual(errors, []);
  const renderArgs = ['assets/render.mjs', '--project', project, '--end', '1'];
  const missing = run(process.execPath, renderArgs, 1, { ...process.env, FFMPEG_PATH: path.join(project, 'missing-ffmpeg') });
  assert.doesNotMatch(missing, /完成：/);
  const failed = run(process.execPath, [...renderArgs, '--out', 'missing-directory/failure.mp4'], 1);
  assert.doesNotMatch(failed, /完成：/);
  console.log('PASS failed ffmpeg launch and nonzero exit never report success');
  run(process.execPath, ['assets/render.mjs', '--project', project, '--page', 'cover.html', '--stills', '0', '--scale', '2', '--name', 'cover.png']);
  const png = readFileSync(path.join(project, 'cover.png'));
  assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1440);
  console.log(`PASS cover 1080x1440; QA artifacts: ${project}`);
} finally { await browser.close(); }
