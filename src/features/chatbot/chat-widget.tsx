"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Bot, LoaderCircle, MessageCircle, RotateCcw, Send, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CHAT_ENDPOINT,
  CHAT_MAX_LENGTH,
  CHAT_SUGGESTIONS,
  CHAT_WELCOME,
  type ChatLink,
  type ChatReply,
} from "./contract";

type Message = { role: "user" | "assistant"; text: string; links?: ChatLink[] };
const welcome: Message = { role: "assistant", text: CHAT_WELCOME };
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

export function ChatWidget() {
  const panelId = useId();
  const titleId = useId();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatReply["mode"] | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const lastQuestion = useRef("");

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, pending, error, open]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function close() {
    setOpen(false);
    launcherRef.current?.focus({ preventScroll: true });
  }

  async function send(question: string, retry = false) {
    const message = question.trim();
    if (!message || message.length > CHAT_MAX_LENGTH || controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    lastQuestion.current = message;
    setPending(true);
    setError("");
    setDraft("");
    if (!retry) setMessages((items) => [...items.slice(-23), { role: "user", text: message }]);
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, topic }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({ error: "Layanan chat belum dapat dihubungi. Silakan coba lagi." }));
      if (!response.ok) throw new Error(result.error || "Pesan belum berhasil dikirim. Silakan coba lagi.");
      const reply = result as ChatReply;
      if (typeof reply.answer !== "string" || !Array.isArray(reply.links)) throw new Error("Jawaban belum tersedia. Silakan coba lagi.");
      setMessages((items) => [...items, { role: "assistant", text: reply.answer, links: reply.links }]);
      setTopic(reply.topic);
      setMode(reply.mode);
    } catch (cause) {
      setError(controller.signal.aborted
        ? "Koneksi terlalu lama. Silakan coba lagi."
        : cause instanceof Error && cause.message !== "Failed to fetch"
          ? cause.message
          : "Tidak dapat terhubung. Periksa koneksi internet, lalu coba lagi.");
    } finally {
      clearTimeout(timeout);
      controllerRef.current = null;
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function reset() {
    setMessages([welcome]);
    setTopic(null);
    setMode(null);
    setDraft("");
    setError("");
    lastQuestion.current = "";
    inputRef.current?.focus();
  }

  return (
    <div className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex max-w-[calc(100%_-_2rem)] flex-col items-end gap-3 sm:right-6 sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))]">
      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}
          className="flex h-[min(35rem,calc(100dvh-7.5rem))] w-[23rem] max-w-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white text-zinc-900 shadow-[0_16px_64px_-12px_rgb(0_0_0/0.25)] [@media(max-height:480px)]:fixed [@media(max-height:480px)]:inset-3 [@media(max-height:480px)]:h-auto [@media(max-height:480px)]:w-auto [@media(max-height:480px)]:max-w-none"
        >
          <header className="bg-brand flex shrink-0 items-center gap-3 px-4 py-4 text-white">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15">
              <Bot className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-sm font-semibold">Asisten SIPENSI</h2>
              <p className="mt-0.5 text-[11px] text-white/90">Tanya seputar perizinan siswa</p>
            </div>
            <button type="button" onClick={reset} disabled={pending} aria-label="Mulai percakapan baru" title="Percakapan baru" className="flex size-9 shrink-0 items-center justify-center rounded-xl outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40">
              <RotateCcw className="size-4" aria-hidden />
            </button>
            <button type="button" onClick={close} aria-label="Tutup chatbot" className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-xl outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white">
              <X className="size-5" aria-hidden />
            </button>
          </header>

          <div ref={logRef} role="log" aria-label="Percakapan dengan Asisten SIPENSI" aria-live="polite" aria-relevant="additions text" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-zinc-50 p-4">
            {messages.map((message, index) => (
              <div key={index} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[92%] rounded-2xl px-3.5 py-3 text-[13px] leading-relaxed wrap-anywhere", message.role === "user" ? "bg-brand rounded-br-md text-white" : "rounded-bl-md border border-zinc-200/80 bg-white text-zinc-700")}>
                  <span className="sr-only">{message.role === "user" ? "Kamu: " : "Asisten SIPENSI: "}</span>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.links && message.links.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.links.map((link) => (
                        <a key={link.href} href={link.href} {...(link.href.startsWith("https://") ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={cn("text-brand inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-medium hover:bg-red-100", focusRing)}>
                          {link.label}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="flex flex-col items-start gap-2">
                <p className="text-[11px] font-medium text-zinc-500">Kamu bisa mulai dari sini</p>
                {CHAT_SUGGESTIONS.map((question) => (
                  <button key={question} type="button" onClick={() => void send(question)} className={cn("hover:border-brand/40 hover:text-brand min-h-10 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-xs text-zinc-600 transition-colors", focusRing)}>
                    {question}
                  </button>
                ))}
              </div>
            )}

            {pending && (
              <p role="status" className="flex items-center gap-2 text-xs text-zinc-500"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />Asisten sedang menjawab…</p>
            )}
          </div>

          <div className="shrink-0 border-t border-zinc-100 bg-white px-4 pt-3 pb-3">
            {error && (
              <div role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                <p>{error}</p>
                <button type="button" onClick={() => void send(lastQuestion.current, true)} disabled={pending} className={cn("mt-1 min-h-8 rounded font-semibold underline underline-offset-2 disabled:opacity-50", focusRing)}>Coba lagi</button>
              </div>
            )}
            <form onSubmit={submit} className="flex items-end gap-2">
              <label htmlFor={inputId} className="sr-only">Pertanyaan tentang SIPENSI</label>
              <textarea
                ref={inputRef}
                id={inputId}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
                maxLength={CHAT_MAX_LENGTH}
                rows={2}
                placeholder="Tanyakan tentang SIPENSI…"
                aria-describedby={`${inputId}-hint`}
                className={cn("min-h-12 min-w-0 flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-base leading-snug placeholder:text-zinc-400 sm:text-sm", focusRing)}
              />
              <button type="submit" disabled={pending || !draft.trim()} aria-label="Kirim pesan" className={cn("bg-brand hover:bg-brand-dark flex size-11 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40", focusRing)}>
                {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />}
              </button>
            </form>
            <div id={`${inputId}-hint`} className="mt-2 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
              <p>Seputar SIPENSI saja · Jangan kirim data pribadi.</p>
              {draft.length > 850 ? <span className="shrink-0">{draft.length}/{CHAT_MAX_LENGTH}</span> : mode ? <span className="shrink-0">{mode === "ai" ? "Dibantu AI" : "Panduan SIPENSI"}</span> : null}
            </div>
          </div>
        </section>
      )}

      <button ref={launcherRef} type="button" aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog" aria-label={open ? "Tutup Asisten SIPENSI" : "Buka Asisten SIPENSI"} onClick={() => open ? close() : setOpen(true)} className={cn("bg-brand hover:bg-brand-dark shadow-brand/25 flex h-14 items-center justify-center gap-2.5 rounded-full px-5 text-sm font-semibold text-white shadow-lg transition-colors", open && "[@media(max-height:480px)]:hidden", focusRing)}>
        {open ? <X className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
        <span>{open ? "Tutup chat" : "Tanya SIPENSI"}</span>
      </button>
    </div>
  );
}
