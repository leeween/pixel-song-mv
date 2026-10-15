"""Build a source-only skill ZIP with an explicit allowlist."""
import argparse
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FILES = ['SKILL.md', 'README.md', 'LICENSE', 'NOTICE.md', 'CONTRIBUTING.md',
         'package.json', 'pnpm-lock.yaml', 'requirements.txt', '.gitignore', '.gitattributes']
FOLDERS = ['assets', 'scripts', 'references', 'agents', 'examples', 'docs', 'tests', '.github']


def package(output):
    output = Path(output).resolve()
    files = [ROOT / name for name in FILES]
    for directory in FOLDERS:
        files.extend(p for p in (ROOT / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix not in {'.pyc', '.pyo'})
    files.append(ROOT / 'demo' / 'README.md')
    if any(p.suffix.lower() in {'.mp3', '.m4a', '.wav', '.mp4', '.mov', '.zip'} for p in files):
        raise ValueError('源码包不应含媒体或嵌套 ZIP，请检查允许列表。')
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for source in sorted(files): archive.write(source, Path('pixel-song-mv') / source.relative_to(ROOT))
    print(f'源码技能包：{output}（{len(files)} 个文件，不含商业歌曲成片、依赖或缓存）')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    parser.add_argument('--out', default=str(ROOT / 'dist' / f'pixel-song-mv-{version}.zip'))
    args = parser.parse_args()
    package(args.out)
