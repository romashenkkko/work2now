import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Props = { onClose: () => void };

export default function RoleModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const modal = (
    <div
      className={`role-modal role-modal--centered ${active ? "active" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="role-modal-title"
    >
      <div className="role-modal-overlay" onClick={onClose} aria-hidden />
      <div className="role-modal-center">
        <div className="role-modal-content" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="role-modal-close"
          onClick={onClose}
          aria-label={t("dashboard.close")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <h2 id="role-modal-title" className="role-modal-title">{t("roleModal.title")}</h2>
        <p className="role-modal-question">{t("roleModal.question")}</p>
        <div className="role-options">
          <Link to="/register/staff" onClick={onClose} className="role-option">
            <div className="role-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor" />
              </svg>
            </div>
            <div className="role-info">
              <h3>{t("roleModal.staff")}</h3>
              <p>{t("roleModal.staffDesc")}</p>
            </div>
          </Link>
          <Link to="/register/customer" onClick={onClose} className="role-option">
            <div className="role-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M20 6H16L14 4H10L8 6H4C2.9 6 2 6.9 2 8V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V8C22 6.9 21.1 6 20 6ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15Z" fill="currentColor" />
              </svg>
            </div>
            <div className="role-info">
              <h3>{t("roleModal.customer")}</h3>
              <p>{t("roleModal.customerDesc")}</p>
            </div>
          </Link>
        </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
