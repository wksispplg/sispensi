export const CHAT_ENDPOINT = "/api/chat";
export const CHAT_MAX_LENGTH = 1000;
export const OFF_TOPIC_REPLY =
  "Mohon ajukan pertanyaan seputar website SIPENSI saja.";

export type ChatLink = { label: string; href: string };

export type ChatReply = {
  answer: string;
  topic: string | null;
  links: ChatLink[];
  mode: "ai" | "panduan";
};

export const CHAT_SUGGESTIONS = [
  "Apa itu SIPENSI?",
  "Bagaimana cara mengajukan izin?",
  "Bagaimana jika lupa password?",
] as const;

export const CHAT_WELCOME =
  "Halo! Saya Asisten SIPENSI. Saya bisa membantu menjelaskan cara login, pengajuan izin, dan fitur di website ini. Apa yang ingin kamu tanyakan?";
