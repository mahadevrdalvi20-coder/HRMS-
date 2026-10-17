import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getApiSession } from "@/lib/auth";
import { agentConfig } from "@/lib/agent/run";

export const maxDuration = 30;

/** Ask HR chat. The agent acts as the signed-in user; the model never receives keys or sensitive fields. */
export async function POST(req: Request) {
  const s = await getApiSession();
  if (!s) return Response.json({ error: "Sign in" }, { status: 401 });
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return Response.json({ error: "Ask HR is not configured (GOOGLE_GENERATIVE_AI_API_KEY)" }, { status: 503 });
  const { messages } = (await req.json()) as { messages: UIMessage[] };
  const recent = (messages ?? []).slice(-12);
  const result = streamText({ ...agentConfig(s), messages: convertToModelMessages(recent, { ignoreIncompleteToolCalls: true }) });
  return result.toUIMessageStreamResponse();
}
