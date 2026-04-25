import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { loadDashboardRouteData } from "./route-data";

export default async function HomePage() {
  const data = await loadDashboardRouteData();

  return <DashboardHome data={data} />;
}
