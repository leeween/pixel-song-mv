"""Build the original minimal project. Only Python's standard library is needed."""
import argparse
import array
import json
import math
from pathlib import Path
import shutil
import sys
import wave

ROOT = Path(__file__).resolve().parents[1]


def create(destination):
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError(f'输出目录已存在，请选择新目录以免覆盖工程：{destination}')
    destination.mkdir(parents=True)
    for item in (ROOT / 'assets').iterdir():
        if item.is_file(): shutil.copy2(item, destination / item.name)
    for name in ('scenes.js', 'cover.html', 'plan.json', 'lyrics.txt', 'README.md'):
        shutil.copy2(ROOT / 'examples' / 'minimal' / name, destination / name)
    for name in ('package.json', 'pnpm-lock.yaml', 'LICENSE', 'NOTICE.md'):
        shutil.copy2(ROOT / name, destination / name)
    # Standalone delivery keeps pnpm commands valid without a second dependency tree.
    package = json.loads((destination / 'package.json').read_text(encoding='utf-8'))
    package['scripts'] = {'render': 'node render.mjs', 'browser:install': 'playwright install chromium'}
    (destination / 'package.json').write_text(json.dumps(package, indent=2) + '\n', encoding='utf-8')
    (destination / 'config.js').write_text("window.MV_CONFIG = { format: 'landscape', script: 'sc', audio: 'song.wav' };\n", encoding='utf-8')
    plan = json.loads((destination / 'plan.json').read_text(encoding='utf-8'))
    beats = [k * .5 for k in range(24)]
    (destination / 'beats.json').write_text(json.dumps(beats) + '\n', encoding='utf-8')
    lines = (destination / 'lyrics.txt').read_text(encoding='utf-8').splitlines()
    timing = {
        'bpm': 120, 'shift': 0, 'duration': 12, 'beats': beats,
        'sections': [{'name': n, 'start': a * .5, 'end': min(12, b * .5)} for n, a, b in plan['sections']],
        'lyrics': [{'text': text, 'start': a * .5, 'end': b * .5 - .05} for text, (a, b) in zip(lines, plan['lines'])],
    }
    (destination / 'lyrics.js').write_text('window.MV_TIMING = ' + json.dumps(timing, ensure_ascii=False) + ';\n', encoding='utf-8')
    rate = 22050
    samples = array.array('h')
    # Ascending tones, a new note every half-second; no sampled or existing melody.
    notes = [220, 261.6256, 329.6276, 391.9954, 293.6648, 349.2282, 440, 523.2511]
    for i in range(rate * 12):
        t = i / rate
        phase = t % .5
        frequency = notes[int(t * 2) % len(notes)]
        envelope = min(1, phase / .012) * math.exp(-phase * 9) * min(1, (12 - t) / .2)
        tone = math.sin(2 * math.pi * frequency * phase) + .2 * math.sin(2 * math.pi * frequency * 2 * phase)
        value = int(9000 * envelope * tone)
        samples.extend((value, value))
    if sys.byteorder != 'little': samples.byteswap()
    with wave.open(str(destination / 'song.wav'), 'wb') as wav:
        wav.setnchannels(2); wav.setsampwidth(2); wav.setframerate(rate); wav.writeframes(samples.tobytes())
    print(f'示例已生成：{destination}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', default=str(ROOT / 'output' / 'minimal'))
    args = parser.parse_args()
    try: create(args.out)
    except (ValueError, OSError) as error: parser.exit(1, f'{error}\n')
