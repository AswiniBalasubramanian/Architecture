import { defaultBrief, generate, VARIANTS } from "../src/lib/generator";
import { checkRules, rulesFromText, describeRule, type LayoutRule } from "../src/lib/layoutRules";
import type { DirectionId } from "../src/lib/types";

const text = "Kitchen should be in the south-east. Pooja room in the north-east corner. Stair on the left side. Master bedroom at the back right. Living room at the front. Parking in the front.";
const rules = rulesFromText(text);
console.log(rules.map(describeRule));

const sets: Record<string, LayoutRule[]> = { all: rules };
for (const r of rules) sets[describeRule(r)] = [r];
for (const facing of ["east", "north"] as const)
  for (const [name, rs] of Object.entries(sets)) {
    const b0 = defaultBrief(); const brief = { ...b0, facing, layoutRules: rs, requirements: [...b0.requirements, "pooja" as const] };
    const row: string[] = [];
    for (const d of ["open", "core", "courtyard"] as DirectionId[]) {
      const best = generate(brief, d);
      const any = Math.max(...VARIANTS.map((_, v) => checkRules(brief, generate(brief, d, v)).reduce((s, c) => s + c.score, 0) / rs.length));
      const got = checkRules(brief, best).reduce((s, c) => s + c.score, 0) / rs.length;
      row.push(`${d}=${got.toFixed(2)}(max ${any.toFixed(2)})`);
    }
    console.log(facing.padEnd(6), name.padEnd(36), row.join("  "));
  }
