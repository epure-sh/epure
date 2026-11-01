import { Navigate } from "react-router-dom";
import { billingPath } from "@/lib/paths";

/** Usage lives on Usage & Billing — keep /usage as a stable alias. */
export function UsagePage() {
  return <Navigate to={billingPath()} replace />;
}
