import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import FindJobs from "./pages/FindJobs";
import FindStaff from "./pages/FindStaff";
import Contact from "./pages/Contact";
import Blog from "./pages/Blog";
import Login from "./pages/Login";
import Register from "./pages/Register";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import DashboardJoburi from "./pages/DashboardJoburi";
import DashboardAplicatii from "./pages/DashboardAplicatii";
import DashboardRapoarte from "./pages/DashboardRapoarte";
import DashboardCalendar from "./pages/DashboardCalendar";
import DashboardMesaje from "./pages/DashboardMesaje";
import DashboardSettings from "./pages/DashboardSettings";
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import Employers from "./pages/Employers";
import AppPage from "./pages/AppPage";
import Locations from "./pages/Locations";

export default function App() {
  return (
    <div className="page-enter min-h-screen w-full">
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="joburi" element={<DashboardJoburi />} />
        <Route path="aplicatii" element={<DashboardAplicatii />} />
        <Route path="rapoarte" element={<DashboardRapoarte />} />
        <Route path="calendar" element={<DashboardCalendar />} />
        <Route path="mesaje" element={<DashboardMesaje />} />
        <Route path="settings" element={<DashboardSettings />} />
      </Route>
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/find-jobs" element={<FindJobs />} />
            <Route path="/find-staff" element={<FindStaff />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/about" element={<About />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/employers" element={<Employers />} />
            <Route path="/app" element={<AppPage />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/:role" element={<Register />} />
          </Routes>
        </Layout>
      } />
    </Routes>
    </div>
  );
}
