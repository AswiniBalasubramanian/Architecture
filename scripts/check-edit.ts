// Wall drags must keep every floor exactly tiled. Run: npx tsx scripts/check-edit.ts
import { defaultBrief, generate } from "../src/lib/generator";
import { movableWalls, moveWall } from "../src/lib/edit";
let moves = 0, broken = 0;
for (const dir of ["open", "core", "courtyard"] as const)
  for (let v = 0; v < 8; v++) {
    const brief = defaultBrief();
    const d = generate(brief, dir, v);
    for (let f = 0; f < brief.floors; f++)
      for (const line of movableWalls(d, f))
        for (const delta of [-3, -1, 1, 2.5, 6]) {
          const e = moveWall(d, line, delta);
          moves++;
          const fp = e.footprint;
          const area = e.rooms.filter((r) => r.floor === f).reduce((s, r) => s + r.w * r.d, 0);
          const tooSmall = e.rooms.some((r) => r.w < 3.9 || r.d < 3.9);
          if (Math.abs(area - fp.w * fp.d) > 0.6 || tooSmall) broken++;
        }
  }
console.log(`wall moves ${moves}, broken ${broken}`);
