const API = process.env.NEXT_PUBLIC_API_URL;

export interface Session {
  sessionId: string;
  sessionUserToken: string;
  status: "unassigned" | "active" | "closed" | "transferred";
  needCategory: string;
  assignedNavigatorId: string | null;
  routingFailReason: string | null;
}

export interface Message {
  eventId: string;
  body: string;
  timestamp: number;
}

export async function createSession(
  needCategory: string,
  language: string | null
): Promise<Session> {
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ need_category: needCategory, language }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to create session (${res.status})`);
  }
  return res.json();
}

export async function getSession(
  sessionId: string,
  token: string
): Promise<Session> {
  const res = await fetch(`${API}/sessions/${sessionId}?token=${token}`);
  if (!res.ok) throw new Error(`Failed to get session (${res.status})`);
  return res.json();
}

export async function sendMessage(
  sessionId: string,
  token: string,
  body: string
): Promise<void> {
  const res = await fetch(`${API}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to send message (${res.status})`);
  }
}

export async function fetchMessages(
  sessionId: string,
  token: string
): Promise<Message[]> {
  const res = await fetch(
    `${API}/sessions/${sessionId}/messages?token=${token}`
  );
  if (!res.ok) throw new Error(`Failed to fetch messages (${res.status})`);
  const data = await res.json();
  return data.messages ?? [];
}

export async function closeSession(
  sessionId: string,
  token: string
): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/user-close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken: token }),
  });
}
