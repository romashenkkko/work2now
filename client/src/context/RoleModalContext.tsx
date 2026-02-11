import { createContext, useContext, useState, ReactNode } from "react";
import RoleModal from "../components/RoleModal";

const RoleModalContext = createContext<{ openRoleModal: () => void } | null>(null);

export function RoleModalProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <RoleModalContext.Provider value={{ openRoleModal: () => setShow(true) }}>
      {children}
      {show && <RoleModal onClose={() => setShow(false)} />}
    </RoleModalContext.Provider>
  );
}

export function useRoleModal() {
  const ctx = useContext(RoleModalContext);
  return ctx;
}
