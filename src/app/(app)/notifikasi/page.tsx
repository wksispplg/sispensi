import { requireProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { NotificationList } from "./notification-list";
import { getPendingApprovals } from "@/features/approvals/data";

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications")
    .select("id, title, message, request_id, created_at, is_read")
    .eq("user_id", profile.id).order("created_at", { ascending: false });
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">Notifikasi belum dapat dimuat. Silakan muat ulang halaman.</p>;
  const items = data ?? [];
  const pending = profile.role === ROLES.SISWA ? [] : (await getPendingApprovals(profile)).items;
  // Snapshot waktu per request, bukan waktu baru pada tiap render di browser.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return <NotificationList key={profile.id} initialItems={items} now={now} role={profile.role} pendingRequests={pending} />;
}
