#!/usr/bin/env python3
# 像素 MV 音频分析工具（只依赖 numpy / scipy / matplotlib + ffmpeg）
#   python3 analyze.py beats   song.mp3 out/            # 解码、估 BPM、逐拍跟踪、段落重复结构、每拍人声比例
#   python3 analyze.py vocals  out/ lyrics.js 25-60 60-95 # 人声音高图 + 当前歌词起点标记（核对同步用）
#   python3 analyze.py build   out/ plan.json lyrics.txt > lyrics.js   # 按拍号生成歌词时间轴
import sys, os, json, subprocess, argparse
from pathlib import Path
import numpy as np, scipy.io.wavfile as wf, scipy.signal as ss, scipy.ndimage as nd
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt

def decode(mp3, out):
    os.makedirs(out, exist_ok=True)
    for name, args in (('mono16k.wav', ['-ac', '1', '-ar', '16000']), ('st22k.wav', ['-ac', '2', '-ar', '22050'])):
        subprocess.run([os.environ.get('FFMPEG_PATH', 'ffmpeg'), '-v', 'error', '-y', '-i', mp3, *args, os.path.join(out, name)], check=True)

def load(path):
    sr, x = wf.read(path); return sr, x.astype(np.float32) / 32768

def onset_env(x, sr, hop=80):
    f, t, Z = ss.stft(x, sr, nperseg=1024, noverlap=1024 - hop)
    P = np.log1p(100 * np.abs(Z))
    o = np.maximum(np.diff(P[f < 4000], axis=1), 0).sum(0); o -= ss.medfilt(o, 51); o = np.maximum(o, 0)
    return np.convolve(o, np.ones(5) / 5, 'same'), sr / hop

def estimate_bpm(o, fps, dur):
    if dur < 4 or len(o) < 4 * fps:
        raise ValueError('音频太短：节拍估计至少需要 4 秒；极短片段请手动设置时间轴。')
    seg = o[int(10 * fps):int((dur - 10) * fps)] if dur >= 30 else o
    seg = seg - seg.mean()
    if not np.isfinite(seg).all() or seg.std() < 1e-9:
        raise ValueError('没有可识别的节拍变化；请使用有节奏的音频或手动设置时间轴。')
    # FFT avoids quadratic cost on full songs. Short clips contribute only valid lags.
    ac = ss.correlate(seg, seg, mode='full', method='fft')[len(seg) - 1:]
    cands = []
    for b in np.arange(60, 200, 0.25):
        lags = [int(round(60 / b * fps * k)) for k in (1, 2, 4)]
        cands.append((sum(ac[lag] for lag in lags if lag < len(ac)), b))
    cands.sort(reverse=True)
    bpm = cands[0][1]
    # 在 70~140 之间选一个倍频（舞曲/抒情歌一般落在这里）
    while bpm > 140: bpm /= 2
    while bpm < 70: bpm *= 2
    return float(bpm), [float(c[1]) for c in cands[:6]]

def track_beats(o, fps, bpm, alpha=100):
    o = o / (o.std() + 1e-9); period = fps * 60 / bpm
    N = len(o); score = o.copy(); back = -np.ones(N, int); lo, hi = int(period * 0.8), int(period * 1.25)
    for i in range(hi, N):
        prev = np.arange(i - hi, i - lo); pen = -alpha * (np.log((i - prev) / period)) ** 2
        j = np.argmax(score[prev] + pen); score[i] = o[i] + score[prev][j] + pen[j]; back[i] = prev[j]
    tail = min(N, max(1, int(period) * 2))
    i = int(np.argmax(score[-tail:])) + N - tail; beats = []
    while i >= 0: beats.append(i / fps); i = back[i]
    return np.array(beats[::-1])

def chroma_per_beat(x, sr, beats):
    f, t, Z = ss.stft(x, sr, nperseg=4096, noverlap=4096 - 400); Mg = np.abs(Z); fps = sr / 400
    sel = (f >= 100) & (f <= 2000); pc = np.round(69 + 12 * np.log2(f[sel] / 440)).astype(int) % 12
    CH = np.zeros((12, Mg.shape[1]))
    for k in range(12): CH[k] = Mg[sel][pc == k].sum(0)
    B = np.array([CH[:, int(a * fps):max(int(a * fps) + 1, int(b * fps))].mean(1) for a, b in zip(beats[:-1], beats[1:])]).T
    return B / (np.linalg.norm(B, axis=0, keepdims=True) + 1e-9)

def vocal_ratio_per_beat(xs, sr, beats):
    M = (xs[:, 0] + xs[:, 1]) / 2; S = (xs[:, 0] - xs[:, 1]) / 2
    f, t, ZM = ss.stft(M, sr, nperseg=4096, noverlap=4096 - 441); _, _, ZS = ss.stft(S, sr, nperseg=4096, noverlap=4096 - 441)
    V = np.maximum(np.abs(ZM) - np.abs(ZS), 0); fps = sr / 441; band = (f >= 250) & (f <= 3000)
    e = V[band].sum(0) / (np.abs(ZM)[band].sum(0) + 1e-9)
    return np.array([e[int(a * fps):max(int(a * fps) + 1, int(b * fps))].mean() for a, b in zip(beats[:-1], beats[1:])])

def cmd_beats(mp3, out):
    decode(mp3, out)
    sr, x = load(os.path.join(out, 'mono16k.wav')); dur = len(x) / sr
    o, fps = onset_env(x, sr); bpm, cands = estimate_bpm(o, fps, dur)
    beats = track_beats(o, fps, bpm)
    if len(beats) < 2: raise ValueError('有效节拍不足两个，请手动设置时间轴。')
    d = np.diff(beats)
    Path(out, 'beats.json').write_text(json.dumps([round(b, 3) for b in beats.tolist()]), encoding='utf-8')
    print(f'时长 {dur:.2f}s  BPM≈{bpm}（候选 {cands}）  拍数 {len(beats)}  局部 BPM {60/d.max():.1f}~{60/d.min():.1f}')
    # 段落重复结构：16 拍窗口的和弦自相似，按 lag 找重复片段
    B = chroma_per_beat(x, sr, beats); L = 16
    F = np.vstack([np.roll(B, -k, axis=1) for k in range(L)]); F /= np.linalg.norm(F, axis=0, keepdims=True) + 1e-9
    S = F.T @ F; nb = S.shape[0]
    # 去掉整体相似度（流行歌和弦很接近），只看相对突出的对角线
    Sz = (S - S.mean(1, keepdims=True)) / (S.std(1, keepdims=True) + 1e-9)
    found = []
    for lag in range(16, nb - 24, 2):
        dd = np.array([Sz[i, i + lag] for i in range(nb - lag)]); sm = np.convolve(dd, np.ones(16) / 16, 'same')
        idx = np.where(sm > 1.6)[0]
        if not len(idx): continue
        s0 = p = idx[0]
        for i in list(idx[1:]) + [10 ** 9]:
            if i != p + 1:
                if p - s0 >= 16: found.append((p - s0, lag, s0, p, float(sm[s0:p + 1].mean())))
                s0 = i
            p = i
    found.sort(reverse=True)
    print('\n重复片段（同一段旋律/和弦出现两次；A 段的第 a 拍 ≈ B 段的第 a+lag 拍）：')
    for ln, lag, a, b, sc in found[:10]:
        print(f'  拍{a:3d}-{b:3d} ({beats[a]:6.1f}s-{beats[b]:6.1f}s)  ≈  拍{a+lag:3d}-{b+lag:3d} ({beats[min(a+lag,len(beats)-1)]:6.1f}s-{beats[min(b+lag,len(beats)-1)]:6.1f}s)  lag={lag} 长度={ln}拍')
    # 每拍"中置人声比例"（>0.8 通常有主唱；注意左右声道的和声/rap 会被低估）
    sr2, xs = load(os.path.join(out, 'st22k.wav')); vr = vocal_ratio_per_beat(xs, sr2, beats)
    with open(os.path.join(out, 'vocal_per_beat.txt'), 'w', encoding='utf-8') as fh:
        for k in range(0, len(vr), 4): fh.write(f'拍{k:4d} {beats[k]:7.2f}s  ' + ' '.join(f'{v:.2f}' for v in vr[k:k + 4]) + '\n')
    # 总览图
    f, t, Z = ss.stft(x, sr, nperseg=2048, noverlap=2048 - 512); P = 20 * np.log10(np.abs(Z) + 1e-9)
    fig, ax = plt.subplots(2, 1, figsize=(24, 8), sharex=True)
    ax[0].plot(beats[:-1], vr); ax[0].set_ylabel('vocal ratio / beat')
    fb = f <= 4000; ax[1].imshow(P[fb], aspect='auto', origin='lower', extent=[t[0], t[-1], 0, 4000], vmin=-90, vmax=-20, cmap='magma')
    for k in range(0, len(beats), 16):
        for a_ in ax: a_.axvline(beats[k], color='c', alpha=.4)
        ax[0].text(beats[k], 1.0, str(k), color='c', fontsize=8)
    plt.tight_layout(); plt.savefig(os.path.join(out, 'overview.png'), dpi=55); plt.close(fig)
    print(f'\n已写出：beats.json、vocal_per_beat.txt、overview.png（目录 {out}）')

def cmd_vocals(out, lyrics_js, ranges, png=None):
    sr, xs = load(os.path.join(out, 'st22k.wav'))
    M = (xs[:, 0] + xs[:, 1]) / 2; S = (xs[:, 0] - xs[:, 1]) / 2
    f, t, ZM = ss.stft(M, sr, nperseg=4096, noverlap=4096 - 256); _, _, ZS = ss.stft(S, sr, nperseg=4096, noverlap=4096 - 256)
    Mag, Side = np.abs(ZM), np.abs(ZS)
    H = nd.median_filter(Mag, size=(1, 31)); Pm = nd.median_filter(Mag, size=(31, 1))
    V = np.maximum(Mag * H ** 2 / (H ** 2 + Pm ** 2 + 1e-12) - Side, 0)   # 去鼓点 + 去两侧伴奏 ≈ 中置主唱
    f0s = np.geomspace(150, 900, 160); df = f[1]; Vn = (V / (V.max(0, keepdims=True) + 1e-9)) ** 0.5
    Sal = np.zeros((len(f0s), V.shape[1]), np.float32)
    for i, f0 in enumerate(f0s):
        for h in range(1, 6):
            bi = int(round(f0 * h / df))
            if bi < V.shape[0]: Sal[i] += Vn[bi] * 0.8 ** (h - 1)
    Sal -= np.median(Sal, 1, keepdims=True); E = np.convolve((V[(f >= 200) & (f <= 2500)] ** 2).sum(0), np.ones(5) / 5, 'same')
    js = Path(lyrics_js).read_text(encoding='utf-8-sig'); TM = json.loads(js[js.index('{'):js.rindex('}') + 1]); L = TM['lyrics']
    beats = TM.get('beats') or json.loads(Path(out, 'beats.json').read_text(encoding='utf-8-sig'))
    segs = [tuple(map(float, r.split('-'))) for r in ranges]
    fig, axs = plt.subplots(len(segs) * 2, 1, figsize=(34, 5.2 * len(segs)), gridspec_kw={'height_ratios': [3, 1] * len(segs)})
    axs = np.atleast_1d(axs)
    for j, (a, b) in enumerate(segs):
        ax, ax2 = axs[2 * j], axs[2 * j + 1]; i = (t >= a) & (t < b)
        ax.pcolormesh(t[i], f0s, np.clip(Sal[:, i] / np.percentile(Sal, 99.5), 0, 1), cmap='magma', shading='auto'); ax.set_yscale('log')
        ax2.plot(t[i], E[i]); ax2.set_xlim(a, b)
        for k, bt in enumerate(beats):
            if a <= bt <= b and k % 4 == 0:
                for a_ in (ax, ax2): a_.axvline(bt, color='w', alpha=.4)
                ax.text(bt, 155, str(k), color='w', fontsize=9)
        for q, l in enumerate(L):
            if a <= l['start'] <= b:
                for a_ in (ax, ax2): a_.axvline(l['start'], color='lime', lw=2)
                ax.text(l['start'] + .05, 800, str(q), color='lime', fontsize=14, weight='bold')
        for a_ in (ax, ax2): a_.set_xticks(np.arange(int(a), int(b) + 1, 1)); a_.tick_params(labelsize=8)
    png = png or os.path.join(out, 'vocals_' + '_'.join(r.replace('.', '') for r in ranges) + '.png')
    plt.tight_layout(); plt.savefig(png, dpi=44); plt.close(fig); print(png)

def cmd_build(out, plan_json, lyrics_txt, output=None):
    plan = json.loads(Path(plan_json).read_text(encoding='utf-8-sig'))
    beats = np.array(json.loads(Path(out, 'beats.json').read_text(encoding='utf-8-sig')))
    lines = [l.strip() for l in Path(lyrics_txt).read_text(encoding='utf-8-sig').splitlines() if l.strip()]
    rows = plan['lines']
    if len(rows) != len(lines): raise ValueError(f'歌词 {len(lines)} 句，plan 里 {len(rows)} 个位置')
    if len(beats) < 2 or not np.isfinite(beats).all() or np.any(np.diff(beats) <= 0):
        raise ValueError('beats.json 必须包含至少两个有限且递增的时间。')
    if not np.isfinite(plan['duration']) or plan['duration'] <= 0 or not np.isfinite(plan['bpm']) or plan['bpm'] <= 0:
        raise ValueError('duration 和 bpm 必须是正数。')
    if any(len(row) != 2 or not all(np.isfinite(k) for k in row) or row[0] < 0 or row[1] <= row[0] for row in rows):
        raise ValueError('每行歌词的拍号必须满足 0 ≤ 起拍 < 止拍。')
    def B(k):
        if k <= 0: return float(beats[0] + k * 60 / plan['bpm'])
        if k >= len(beats) - 1: return float(beats[-1] + (k - len(beats) + 1) * 60 / plan['bpm'])
        return float(np.interp(k, np.arange(len(beats)), beats))
    shift = plan.get('shift', 0)
    if not np.isfinite(shift): raise ValueError('shift 必须是有限拍数。')
    lead = plan.get('lead', 0.5)
    lyr = [{'start': round(B(a + shift) - lead, 2), 'end': round(B(b + shift) - lead - 0.05, 2), 'text': s} for s, (a, b) in zip(lines, rows)]
    secs = [{'name': n, 'start': round(0 if a == 0 else B(a + shift), 2), 'end': round(B(b + shift) if b < 10 ** 5 else plan['duration'], 2)} for n, a, b in plan['sections']]
    TM = {'bpm': plan['bpm'], 'shift': shift, 'beats': [round(b, 3) for b in beats.tolist()], 'duration': plan['duration'], 'sections': secs, 'lyrics': lyr}
    js = '// Generated by analyze.py build; times in seconds.\nwindow.MV_TIMING = ' + json.dumps(TM, ensure_ascii=False) + ';\n'
    if output:
        with open(output, 'w', encoding='utf-8') as fh: fh.write(js)
    else: print(js, end='')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='像素 MV 音频分析和时间轴生成')
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('beats'); p.add_argument('audio'); p.add_argument('out')
    p = sub.add_parser('vocals'); p.add_argument('out'); p.add_argument('lyrics'); p.add_argument('ranges', nargs='+')
    p = sub.add_parser('build'); p.add_argument('out'); p.add_argument('plan'); p.add_argument('lyrics'); p.add_argument('--output')
    args = parser.parse_args()
    try:
        if args.command == 'beats': cmd_beats(args.audio, args.out)
        elif args.command == 'vocals': cmd_vocals(args.out, args.lyrics, args.ranges)
        else: cmd_build(args.out, args.plan, args.lyrics, args.output)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'分析失败：{error}\n')
