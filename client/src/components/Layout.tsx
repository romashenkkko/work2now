import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { RoleModalProvider } from "../context/RoleModalContext";
import Header from "./Header";
import Footer from "./Footer";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <RoleModalProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main key={location.pathname} className="flex-1 page-enter">
          {children}
        </main>
        <Footer />
      </div>
    </RoleModalProvider>
  );
}
