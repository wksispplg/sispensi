"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { NOTIFICATIONS_PATH, type Role } from "@/lib/constants";

type Notif = {
  id: string;
  title: string | null;
  message: string;
  is_read: boolean;
  request_id: string | null;
  created_at: string;
};

/** Bunyi "ding" dua nada via Web Audio. */
function playDing(ctx: AudioContext) {
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  for (const [freq, offset] of [
    [880, 0],
    [1318.5, 0.12],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + offset;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

export function NotificationBell({
  userId,
}: {
  userId: string;
  role: Role;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const audioRef = useRef<AudioContext | null>(null);
  const dingPendingRef = useRef(false);

  // Muat notifikasi awal.
  useEffect(() => {
    let active = true;
    supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("is_read", false)
      .then(({ count }) => { if (active && count !== null) setUnread(count); });
    return () => {
      active = false;
    };
  }, [supabase, userId]);

  // Buka kunci audio pada interaksi apa pun (kebijakan autoplay browser) dan
  // selalu resume bila context sempat ter-suspend (mis. tab di-background).
  useEffect(() => {
    const unlock = () => {
      if (!audioRef.current) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AC) {
          try {
            audioRef.current = new AC();
          } catch {
            /* abaikan */
          }
        }
      }
      audioRef.current?.resume().catch(() => {});
    };
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "touchstart",
      "click",
    ];
    events.forEach((e) => window.addEventListener(e, unlock));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  // Jika notifikasi datang saat tab tersembunyi, bunyikan saat tab kembali aktif.
  useEffect(() => {
    const onVisible = () => {
      const ctx = audioRef.current;
      if (
        document.visibilityState === "visible" &&
        dingPendingRef.current &&
        ctx
      ) {
        dingPendingRef.current = false;
        ctx.resume().catch(() => {});
        playDing(ctx);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Langganan realtime (INSERT untuk user ini).
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType !== "INSERT") {
            supabase.from("notifications").select("id", { count: "exact", head: true })
              .eq("user_id", userId).eq("is_read", false)
              .then(({ count }) => { if (count !== null) setUnread(count); });
            return;
          }
          const n = payload.new as Notif;
          if (!n.is_read) setUnread((previous) => previous + 1);
          if (document.visibilityState !== "visible") {
            dingPendingRef.current = true; // bunyikan saat tab kembali aktif
          } else if (audioRef.current) {
            playDing(audioRef.current);
          }
          toast(n.title ?? "Notifikasi", { description: n.message });
          // Segarkan data server (status pengajuan, surat, dll) tanpa reload manual.
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, router]);

  return <Link href={NOTIFICATIONS_PATH} aria-label={`Notifikasi${unread ? ` (${unread} belum dibaca)` : ""}`} className="relative flex size-10 items-center justify-center rounded-full hover:bg-zinc-200/50 focus-visible:outline-2 focus-visible:outline-red-300">
    <Bell className="size-5" strokeWidth={1.6} aria-hidden />
    {unread > 0 ? <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f00000] px-1 text-[9px] text-white">{unread > 9 ? "9+" : unread}</span> : null}
  </Link>;
}
