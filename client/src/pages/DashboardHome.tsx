import { useAuth } from "../hooks/useAuth";
import DashboardHomeCustomer from "./DashboardHomeCustomer";
import DashboardHomeStaff from "./DashboardHomeStaff";
import DashboardHomeAdmin from "./DashboardHomeAdmin";
import DashboardHomeSupport from "./DashboardHomeSupport";

export default function DashboardHome() {
  const { user } = useAuth();

  if (user?.role === "admin") return <DashboardHomeAdmin />;
  if (user?.role === "staff") return <DashboardHomeStaff />;
  if (user?.role === "support") return <DashboardHomeSupport />;
  return <DashboardHomeCustomer />;
}
