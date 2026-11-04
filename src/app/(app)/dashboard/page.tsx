import { getProfile } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getStudentDashboard } from "@/features/izin/student-data";
import { StudentDashboard } from "./student-dashboard";
import { getStaffDashboard } from "@/features/approvals/data";
import { StaffDashboard } from "./staff-dashboard";

export default async function DashboardPage() {
  const profile = await getProfile();
  if (!profile) return null;
  if (profile.role === ROLES.SISWA) {
    const data = await getStudentDashboard(profile.id);
    return <StudentDashboard profile={profile} {...data} />;
  }
  const data = await getStaffDashboard(profile);
  return <StaffDashboard profile={profile} data={data} />;
}
