import { useAuth } from "../hooks/useAuth";
import DashboardHomeCustomer from "./DashboardHomeCustomer";
import DashboardHomeStaff from "./DashboardHomeStaff";
import DashboardHomeAdmin from "./DashboardHomeAdmin";

export default function DashboardHome() {
  const { user } = useAuth();

  if (user?.role === "admin") return <DashboardHomeAdmin />;
  if (user?.role === "staff") return <DashboardHomeStaff />;
  return <DashboardHomeCustomer />;
}
