import { getDashboardData } from "@/features/dashboard/server";

export async function loadDashboardRouteData() {
  return getDashboardData();
}
