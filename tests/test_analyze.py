import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('analyze', ROOT / 'scripts' / 'analyze.py')
analyze = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analyze)


class AnalyzeTests(unittest.TestCase):
    def test_short_rhythmic_clip(self):
        onset = np.zeros(12 * 200)
        onset[::100] = 1
        bpm, _ = analyze.estimate_bpm(onset, 200, 12)
        self.assertAlmostEqual(bpm, 120, delta=1)
        beats = analyze.track_beats(onset, 200, bpm)
        self.assertGreater(len(beats), 15)
        self.assertTrue(np.all(np.diff(beats) > 0))

    def test_silence_and_tiny_input_have_actionable_error(self):
        with self.assertRaisesRegex(ValueError, '节拍变化'):
            analyze.estimate_bpm(np.zeros(2400), 200, 12)
        with self.assertRaisesRegex(ValueError, '至少需要 4 秒'):
            analyze.estimate_bpm(np.ones(200), 200, 1)

    def test_shift_moves_lyrics_and_sections_on_irregular_beats(self):
        with tempfile.TemporaryDirectory() as directory:
            d = Path(directory)
            (d / 'beats.json').write_text('[0, 0.5, 1.2, 1.8, 2.5, 3.0]', encoding='utf-8')
            plan = {'bpm': 120, 'duration': 4, 'lead': .1, 'shift': 1,
                    'lines': [[1, 3]], 'sections': [['开场', 0, 1], ['行动', 1, 1000000000]]}
            (d / 'plan.json').write_text(json.dumps(plan), encoding='utf-8-sig')
            (d / 'lyrics.txt').write_text('原创字幕\n', encoding='utf-8-sig')
            target = d / 'lyrics.js'
            analyze.cmd_build(str(d), str(d / 'plan.json'), str(d / 'lyrics.txt'), str(target))
            js = target.read_text(encoding='utf-8')
            timing = json.loads(js[js.index('{'):js.rindex('}') + 1])
            self.assertEqual(timing['lyrics'][0]['text'], '原创字幕')
            self.assertEqual(timing['lyrics'][0]['start'], 1.1)
            self.assertEqual(timing['sections'][1]['start'], 1.2)
            self.assertEqual(timing['sections'][0]['start'], 0)
            self.assertEqual(timing['shift'], 1)


if __name__ == '__main__':
    unittest.main()
