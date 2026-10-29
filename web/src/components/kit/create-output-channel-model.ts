export type ChannelProvider = "slack" | "discord" | "telegram" | "email" | "webhook";

export type OutputChannelStep = 1 | 2 | 3;

export interface ProjectChoice {
  id: string;
  name: string;
  slug?: string;
}

export interface MemberChoice {
  email: string;
  display_name?: string | null;
}

export interface OutputChannelDraft {
  provider: ChannelProvider | null;
  label: string;
  projectIds: string[];
  url: string;
  recipients: string[];
  botToken: string;
  chatId: string;
}

export const CHANNEL_PROVIDERS: Array<{
  id: ChannelProvider;
  label: string;
  description: string;
}> = [
  {
    id: "slack",
    label: "Slack",
    description: "Post to a channel via Incoming Webhook",
  },
  {
    id: "discord",
    label: "Discord",
    description: "Post to a channel via webhook URL",
  },
  {
    id: "telegram",
    label: "Telegram",
    description: "Send messages with a bot token + chat id",
  },
  {
    id: "email",
    label: "Email",
    description: "Notify org members through Resend",
  },
  {
    id: "webhook",
    label: "Webhook",
    description: "Signed HTTPS JSON to your endpoint",
  },
];

export function emptyOutputChannelDraft(): OutputChannelDraft {
  return {
    provider: null,
    label: "",
    projectIds: [],
    url: "",
    recipients: [],
    botToken: "",
    chatId: "",
  };
}

export function canAdvanceOutputChannel(
  step: OutputChannelStep,
  draft: OutputChannelDraft,
): boolean {
  if (step === 1) return draft.provider != null;
  if (step === 2) {
    if (!draft.provider || !draft.label.trim() || draft.projectIds.length === 0) return false;
    if (draft.provider === "email") return draft.recipients.length > 0;
    if (draft.provider === "telegram") {
      return draft.botToken.trim().includes(":") && draft.chatId.trim().length > 0;
    }
    return draft.url.trim().startsWith("https://");
  }
  return canAdvanceOutputChannel(2, draft);
}

export function describeOutputChannel(draft: OutputChannelDraft): string {
  const provider = draft.provider ?? "channel";
  const name = draft.label.trim() || "Untitled";
  if (provider === "email") {
    const n = draft.recipients.length;
    return `${name} · email · ${n} recipient${n === 1 ? "" : "s"}`;
  }
  if (provider === "telegram") {
    const chat = draft.chatId.trim();
    return chat ? `${name} · telegram · ${chat}` : `${name} · telegram`;
  }
  return `${name} · ${provider}`;
}

export function draftConfig(draft: OutputChannelDraft): {
  url?: string;
  recipients?: string[];
  bot_token?: string;
  chat_id?: string;
} {
  if (draft.provider === "email") {
    return { recipients: draft.recipients };
  }
  if (draft.provider === "telegram") {
    return {
      bot_token: draft.botToken.trim(),
      chat_id: draft.chatId.trim(),
    };
  }
  return { url: draft.url.trim() };
}

/** One create body per selected project (same destination, cloned per project). */
export function draftToCreateBodies(draft: OutputChannelDraft): Array<{
  project_id: string;
  provider: ChannelProvider;
  label: string;
  config: {
    url?: string;
    recipients?: string[];
    bot_token?: string;
    chat_id?: string;
  };
  require_verify: boolean;
}> {
  if (!draft.provider || draft.projectIds.length === 0) {
    throw new Error("Incomplete draft");
  }
  const config = draftConfig(draft);
  return draft.projectIds.map((project_id) => ({
    project_id,
    provider: draft.provider!,
    label: draft.label.trim(),
    config,
    require_verify: true,
  }));
}
