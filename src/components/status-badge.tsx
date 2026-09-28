import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { REQUEST_STATUS_LABELS, type RequestStatus } from "@/lib/constants";

const STATUS_VARIANT: Record<
  RequestStatus,
  ComponentProps<typeof Badge>["variant"]
> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "secondary",
  expired: "outline",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}
