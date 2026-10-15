// pnpm render --project output/minimal --out mv.mp4
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const allowed = new Set(['project', 'page', 'stills', 'scale', 'name', 'start', 'end', 'fps', 'out', 'audio']);
function options(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    if (!argv[i].startsWith('--') || !allowed.has(key) || argv[i + 1] === undefined || argv[i + 1].startsWith('--')) {
      throw new Error(`无效参数：${argv[i]}。参数需要值；支持 ${[...allowed].map(k => '--' + k).join(', ')}`);
    }
    result[key] = argv[i + 1];
  }
  return result;
}
function number(value, label, { min = 0, integer = false } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || (integer && !Number.isInteger(n))) throw new Error(`${label} 无效：${value}`);
  return n;
}
async function main() {
  const opt = options(process.argv.slice(2));
  const dir = opt.project ? path.resolve(opt.project) : scriptDir;
  const pagePath = path.resolve(dir, opt.page || 'index.html');
  if (!existsSync(pagePath)) throw new Error(`找不到页面：${pagePath}`);
  if (!existsSync(path.join(dir, 'lyrics.js'))) throw new Error('缺少 lyrics.js；先生成时间轴，或运行 scripts/create_example.py。');
  let chromium;
  try { ({ chromium } = await import('playwright')); }
  catch { throw new Error('找不到本地 playwright。请在仓库或工程根目录运行 pnpm install，再运行 pnpm exec playwright install chromium。'); }
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  let ff;
  try {
    const page = await browser.newPage({ viewport: { width: 2000, height: 2000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(pagePath).href + '?render');
    if (errors.length) throw new Error(`页面错误：${errors.join('; ')}`);
    await page.waitForFunction(() => typeof window.renderAt === 'function', null, { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    const [CW, CH] = await page.evaluate(() => { const c = document.getElementById('screen'); return [c.width, c.height]; });
    const grab = async (t, scale) => {
      const png = await page.evaluate(([t, scale]) => {
        window.renderAt(t);
        const src = document.getElementById('screen');
        if (scale === 1) return src.toDataURL('image/png').split(',')[1];
        const c = window.__big || (window.__big = document.createElement('canvas'));
        c.width = src.width * scale; c.height = src.height * scale;
        const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, 0, 0, c.width, c.height);
        return c.toDataURL('image/png').split(',')[1];
      }, [t, scale]);
      if (errors.length) throw new Error(`页面错误：${errors.join('; ')}`);
      return Buffer.from(png, 'base64');
    };
    if (opt.stills !== undefined) {
      const scale = number(opt.scale ?? 1, 'scale', { min: 1, integer: true });
      const times = opt.stills.split(',').map(t => number(t, '截图时间'));
      for (const t of times) {
        const file = opt.name && times.length === 1 ? opt.name : `still_${t}.png`;
        writeFileSync(path.resolve(dir, file), await grab(t, scale));
        console.log(`截图：${file}`);
      }
      return;
    }
    const duration = await page.evaluate(() => window.MV.duration);
    const start = number(opt.start ?? 0, 'start');
    const end = number(opt.end ?? duration, 'end');
    const fps = number(opt.fps ?? 30, 'fps', { min: 1, integer: true });
    if (end <= start || end > duration) throw new Error(`时间范围应满足 0 ≤ start < end ≤ ${duration}`);
    const configuredAudio = await page.evaluate(() => window.MV_CONFIG?.audio || 'song.mp3');
    const audio = path.resolve(dir, opt.audio || configuredAudio);
    if (!existsSync(audio)) throw new Error(`找不到音频：${audio}`);
    const out = path.resolve(dir, opt.out || 'mv.mp4');
    if (out === audio || out === pagePath) throw new Error('输出路径不能覆盖输入文件。');
    ff = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-ss', String(start), '-t', String(end - start), '-i', audio,
      '-vf', `scale=${CW * 2}:${CH * 2}:flags=neighbor`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
      '-tune', 'animation', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
    let failure;
    const closed = new Promise(resolve => {
      ff.once('error', error => { failure = error; resolve(null); });
      ff.once('close', code => { if (code !== 0 && !failure) failure = new Error(`ffmpeg 退出码：${code}`); resolve(code); });
    });
    ff.stdin.on('error', error => { failure ||= error; });
    const total = Math.ceil((end - start) * fps);
    for (let frame = 0; frame < total; frame++) {
      if (failure) throw failure;
      const png = await grab(start + frame / fps, 1);
      await new Promise((resolve, reject) => ff.stdin.write(png, error => error ? reject(failure || error) : resolve()));
      if (frame % (fps * 10) === 0) console.log(`渲染 ${(frame / fps).toFixed(0)}s / ${(end - start).toFixed(1)}s`);
    }
    ff.stdin.end();
    await closed;
    if (failure) throw failure;
    console.log(`完成：${out}（${CW * 2}×${CH * 2}）`);
  } finally {
    if (ff && ff.exitCode === null) ff.kill();
    await browser.close();
  }
}
main().catch(error => { console.error(`导出失败：${error.message}`); process.exitCode = 1; });
