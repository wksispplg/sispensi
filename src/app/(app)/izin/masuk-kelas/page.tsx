import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import PermissionRequestForm from "../ajukan/request-form";

export default async function IzinMasukKelasPage() {
  await requireRole(ROLES.SISWA);
  return <PermissionRequestForm entry />;
}
