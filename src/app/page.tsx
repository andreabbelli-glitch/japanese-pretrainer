import { connection } from "next/server";

import { DashboardHome } from "@/components/dashboard/dashboard-home";

export default async function HomePage() {
  await connection();

  return <DashboardHome />;
}
