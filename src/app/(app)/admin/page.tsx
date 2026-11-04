import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { DataMasterGrid } from "./data-master-grid";

export default async function AdminHomePage() {
  await requireRole(ROLES.ADMIN);
  return <DataMasterGrid />;
}
