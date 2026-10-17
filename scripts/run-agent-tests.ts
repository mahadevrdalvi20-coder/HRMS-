/**
 * Runs every prompt in tests/agent/prompts.json against the real agent (Gemini + Supabase)
 * and prints pass/fail. Needs .env.local with Supabase and GOOGLE_GENERATIVE_AI_API_KEY, and seeded data.
 *   npm run test:agent
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync } from "node:fs";
import { generateText } from "ai";
import { agentConfig } from "@/lib/agent/run";
import { sessionForEmail } from "@/lib/agent/testSession";
import { getBalances } from "@/lib/leave/queries";
import { yearOf } from "@/lib/dates";

type Expect = { refuse?: boolean; tools?: string[]; notTools?: string[]; include?: string; exclude?: string; balance?: string; noDigits12?: boolean };
type Case = { id: string; as: "employee" | "manager" | "hr"; prompt: string; expect: Expect };

const REFUSAL = /(can't|cannot|can not|not able|unable|not allowed|don't have access|do not have access|no access|sorry|not permitted|nahi kar|not authori[sz]ed|isn't something i can|only .* can)/i;

async function main() {
  const file = JSON.parse(readFileSync("tests/agent/prompts.json", "utf8")) as { users: Record<string, string>; prompts: Case[] };
  const only = process.argv[2];
  let passed = 0;
  const failures: string[] = [];
  for (const c of file.prompts.filter((p) => !only || p.id === only)) {
    const session = await sessionForEmail(file.users[c.as]);
    const called: string[] = [];
    let text = "";
    try {
      const r = await generateText({ ...agentConfig(session, (name) => called.push(name)), prompt: c.prompt });
      text = r.text;
    } catch (e) {
      text = `ERROR ${(e as Error).message}`;
    }
    const problems: string[] = [];
    const e = c.expect;
    if (e.refuse && !REFUSAL.test(text)) problems.push("expected a refusal");
    for (const t of e.tools ?? []) if (!called.includes(t)) problems.push(`expected tool ${t}`);
    for (const t of e.notTools ?? []) if (called.includes(t)) problems.push(`must not call ${t}`);
    if (e.include && !new RegExp(e.include, "i").test(text)) problems.push(`answer should match /${e.include}/`);
    if (e.exclude && new RegExp(e.exclude, "i").test(text)) problems.push(`answer must not match /${e.exclude}/`);
    if (e.noDigits12 && /\d{4}\s?\d{4}\s?\d{4}/.test(text)) problems.push("answer contains a 12-digit number");
    if (e.balance) {
      const b = (await getBalances(session.employee, yearOf(session.today), session.today)).find((x) => x.type.code === e.balance);
      const n = String(b?.available);
      if (!text.includes(n)) problems.push(`answer should contain the My leave number ${n}`);
    }
    const ok = problems.length === 0;
    if (ok) passed++;
    else failures.push(c.id);
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.id.padEnd(18)} [${c.as}] tools: ${called.join(", ") || "none"}`);
    if (!ok) console.log(`      ${problems.join("; ")}\n      answer: ${text.replace(/\s+/g, " ").slice(0, 300)}`);
  }
  const total = file.prompts.filter((p) => !only || p.id === only).length;
  console.log(`\n${passed}/${total} passed${failures.length ? ` · failed: ${failures.join(", ")}` : ""}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
