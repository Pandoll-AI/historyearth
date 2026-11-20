import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Runs scripts/check-coast-fit.py on the built data (public/data) and fails when a polygon
// spills into the sea or the basemap shows land-looking water not hidden by sea-fix.json.
// Thresholds live in the script (THRESHOLDS). Needs python3 + shapely/numpy/scipy/Pillow
// and data-raw/ (npm run data); Blue Marble tiles are cached in data-raw/bm6.
const ROOT = path.resolve(__dirname, '..');
const ok = spawnSync('python3', ['-c', 'import shapely, scipy, PIL'], { cwd: ROOT }).status === 0 && fs.existsSync(path.join(ROOT, 'data-raw/ne_10m_land.geojson'));

describe.skipIf(!ok)('coast fit (scripts/check-coast-fit.py)', () => {
  it('every polygon stays on land and muddy water is hidden', () => {
    const out = path.join(os.tmpdir(), `coast-fit-test-${process.pid}`);
    const r = spawnSync('python3', ['scripts/check-coast-fit.py', '--vector', '--raster', '--out', out], { cwd: ROOT, encoding: 'utf8', timeout: 600_000 });
    const res = JSON.parse(fs.readFileSync(`${out}.json`, 'utf8'));
    expect(res.fail, r.stderr.slice(-2000)).toEqual([]);
    expect(r.status).toBe(0);
    expect(res.vector.sea_p95_km_worst).toBeLessThanOrEqual(1.0);
    expect(res.raster.seafix).toBe(true);
    expect(res.raster.residual_km2).toBeLessThanOrEqual(500);
    // The two coasts SJ pointed at are detected and covered.
    const names = res.raster.top.map((c: any) => c.region);
    expect(names).toContain('중국 동해안(창장 하구·저장)');
    expect(names).toContain('인도 서해안(구자라트·캄베이만·콘칸)');
  }, 700_000);
});
