import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { DASHBOARD_PATH, ROLES } from "@/lib/constants";
import { getDecisionHistory } from "@/features/approvals/data";
import { StaffError } from "@/features/approvals/staff-widgets";
import { DecisionHistory } from "./decision-history";

export default async function RiwayatKeputusanPage() {
  const profile = await getProfile();
  if (!profile) return null;
  if (profile.role === ROLES.SISWA) redirect(DASHBOARD_PATH);
  const data = await getDecisionHistory(profile);
  return data.failed ? <StaffError /> : <DecisionHistory requests={data.items} statistics={data.statistics} />;
}
