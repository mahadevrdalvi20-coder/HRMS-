import "server-only";
import { google } from "@ai-sdk/google";
import { stepCountIs } from "ai";
import type { Session } from "@/lib/auth";
import { buildTools } from "./tools";
import { systemPrompt } from "./prompt";
import { MAX_TOOL_CALLS, type ToolName } from "./access";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Shared model + prompt + tools for the chat route and the attack-test script. */
export function agentConfig(s: Session, onCall?: (name: ToolName, input: unknown, output: unknown) => void) {
  return {
    model: google(process.env.AGENT_MODEL || "gemini-flash-latest"),
    system: systemPrompt({
      firstName: s.employee.full_name.split(" ")[0],
      code: s.employee.employee_code,
      role: [s.isHr && "HR Admin", s.isManager && "Manager"].filter(Boolean).join(" + ") || "Employee",
      location: s.location.name,
      weeklyOff: s.location.weekly_off_days.map((d) => DAYS[d]).join(" + "),
      today: s.today,
    }),
    tools: buildTools(s, { onCall }),
    // Up to 5 tool rounds plus one final answer. buildTools also hard-limits calls to 5.
    stopWhen: stepCountIs(MAX_TOOL_CALLS + 1),
    temperature: 0.2,
  };
}
