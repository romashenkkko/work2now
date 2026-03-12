import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { RoleModalProvider } from "../context/RoleModalContext";
import Header from "./Header";
import Footer from "./Footer";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <RoleModalProvider>
      <div className="min-h-screen flex flex-col overflow-x-hidden min-w-0">
        <Header />
        <main key={location.pathname} className="flex-1 page-enter min-w-0 w-full">
          {children}
        </main>
        <Footer />
      </div>
    </RoleModalProvider>
  );
}
