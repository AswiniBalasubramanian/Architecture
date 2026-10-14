// Property test for the generator: across many briefs, directions and variants,
// rooms must tile each floor exactly, every room must be reachable, and we
// report plan-check scores. Run: npx tsx scripts/check-plans.ts
import { defaultAssumptions, defaultBrief, generate, VARIANTS } from "../src/lib/generator";
import { checkPlan } from "../src/lib/planCheck";
import { checkVastu } from "../src/lib/vastu";
import type { Brief, DirectionId, HouseType } from "../src/lib/types";

const directions: DirectionId[] = ["open", "core", "courtyard"];
const types: HouseType[] = ["villa", "duplex", "contemporary", "traditional", "compact"];
let briefs = 0;
let tileFail = 0;
let unreachable = 0;
const scores: number[] = [];
const bestScores: number[] = [];
const vastuScores: number[] = [];

for (const [w, d] of [
  [30, 40],
  [30, 50],
  [40, 60],
  [50, 80],
  [60, 90],
])
  for (const floors of [1, 2, 3])
    for (const bedrooms of [2, 3, 4])
      for (const type of types) {
        const brief: Brief = {
          ...defaultBrief(),
          plotWidth: w,
          plotDepth: d,
          floors,
          bedrooms,
          bathrooms: bedrooms,
          houseType: type,
          builtUp: Math.round(w * d * 0.55 * Math.min(floors, 2)),
          assumptions: defaultAssumptions(w, d),
          requirements: bedrooms % 2 ? ["parking", "utility", "vastu", "pooja"] : ["study", "garden"],
          facing: (["north", "east", "south", "west"] as const)[(w + bedrooms) % 4],
        };
        briefs++;
        for (const dir of directions) {
          for (let v = 0; v < VARIANTS.length; v++) {
            const design = generate(brief, dir, v);
            const fp = design.footprint;
            for (let f = 0; f < floors; f++) {
              const area = design.rooms.filter((r) => r.floor === f).reduce((s, r) => s + r.w * r.d, 0);
              if (Math.abs(area - fp.w * fp.d) > 1) tileFail++;
            }
            const check = checkPlan(design, floors);
            unreachable += check.items.filter((i) => i.group === "Circulation" && i.status === "fail").length;
            scores.push(check.score);
          }
          const best = generate(brief, dir);
          bestScores.push(checkPlan(best, floors).score);
          if (brief.requirements.includes("vastu")) vastuScores.push(checkVastu(brief, best).score);
        }
      }
const avg = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) / Math.max(1, a.length));
console.log(`briefs ${briefs}, layouts ${scores.length}`);
console.log(`tiling failures ${tileFail}, unreachable rooms ${unreachable}`);
console.log(`plan score: all variants avg ${avg(scores)}, chosen avg ${avg(bestScores)}, min chosen ${Math.min(...bestScores)}`);
console.log(`vastu score (chosen, when requested): avg ${avg(vastuScores)}, min ${Math.min(...vastuScores)}`);
