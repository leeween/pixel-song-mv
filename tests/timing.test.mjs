import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('scene clock shifts along actual irregular beats, including extrapolation', () => {
  const context = {
    window: { PX: { AW: 480, AH: 270, UW: 960, UH: 540, PORTRAIT: false,
      C: x => x, Raster: class {}, lerp: (a, b, k) => a + (b - a) * k } },
  };
  vm.runInNewContext(readFileSync(new URL('../assets/kit.js', import.meta.url), 'utf8'), context);
  const clock = context.window.KIT.beatClock([0, .5, 1.2, 1.8, 2.5, 3], 120, 1);
  assert.equal(clock.BT(1), 1.2);
  assert.equal(clock.beatPos(1.2), 1);
  assert.equal(clock.BT(6), 4);
});
