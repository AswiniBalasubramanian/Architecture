import { applyOps, readCommand } from "../src/lib/commands";
import { defaultBrief, generate } from "../src/lib/generator";

const brief = defaultBrief();
const design = generate(brief, "open");
const ctx = { design, brief, selectedRoomId: design.rooms.find((r) => r.type === "master")?.id ?? null };
const tests = [
  "gable roof",
  "Show the whole house with a gable roof",
  "Make it four bedrooms",
  "add a bedroom",
  "Kitchen in the south-east",
  "Add a sofa to the living room",
  "add 2 plants to the living room",
  "remove the tv from the living room",
  "Swap kitchen and dining",
  "Paint the master bedroom walls sage",
  "Night view with lights on",
  "Make the living room bigger by 3 ft",
  "rename Bedroom 2 to Guest room",
  "convert bedroom 2 into a study",
  "add a pooja room",
  "remove parking",
  "switch to courtyard layout",
  "exterior laterite",
  "interior japandi",
  "marble flooring in the living room",
  "bigger windows in the kitchen",
  "make it G+2",
  "undo",
  "make the roof purple polka",
];
for (const t of tests) {
  const { ops, reply } = readCommand(t, ctx);
  const r = applyOps(ctx, ops);
  console.log(`${t.padEnd(44)} → ${ops.map((o) => o.op).join(", ") || "—"} | ${[...r.done, ...r.failed.map((f) => "✗ " + f), ...r.ui.map((u) => "ui:" + u.op)].join("; ") || reply.slice(0, 60)}`);
}
