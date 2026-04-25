import { getDashboardData } from "@/lib/dashboard";

export async function loadDashboardRouteData() {
  return getDashboardData();
}
