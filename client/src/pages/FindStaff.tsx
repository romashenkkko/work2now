import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

export default function FindStaff() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("findStaff.title")}</h1>
      <p className="text-gray-600 mb-8">{t("findStaff.lead")}</p>

      {!user && (
        <div className="rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/10 p-8 text-center mb-14 shadow-soft">
          <h3 className="text-primary font-bold text-xl mb-3">{t("findStaff.ctaTitle")}</h3>
          <p className="text-gray-600 mb-6">{t("findStaff.ctaLead")}</p>
          <Link to="/register/customer" className="btn-primary">
            {t("findStaff.ctaBtn")}
          </Link>
        </div>
      )}

      {user && (
        <div className="text-center mb-14">
          <Link to="/dashboard" className="btn-primary px-8 py-4 text-lg">
            {t("findStaff.postJob")}
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 mb-16">
        <div className="card-soft text-center p-8 hover:border-secondary/30">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary mx-auto mb-5 flex items-center justify-center text-3xl text-white shadow-soft">📋</div>
          <h3 className="font-bold text-gray-900 mb-3">{t("findStaff.postJobs")}</h3>
          <p className="text-gray-600 text-sm">{t("findStaff.postJobsDesc")}</p>
        </div>
        <div className="card-soft text-center p-8 hover:border-secondary/30">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary mx-auto mb-5 flex items-center justify-center text-3xl text-white shadow-soft">👥</div>
          <h3 className="font-bold text-gray-900 mb-3">{t("findStaff.seeCandidates")}</h3>
          <p className="text-gray-600 text-sm">{t("findStaff.seeCandidatesDesc")}</p>
        </div>
        <div className="card-soft text-center p-8 hover:border-secondary/30">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary mx-auto mb-5 flex items-center justify-center text-3xl text-white shadow-soft">⚡</div>
          <h3 className="font-bold text-gray-900 mb-3">{t("findStaff.fastRecruit")}</h3>
          <p className="text-gray-600 text-sm">{t("findStaff.fastRecruitDesc")}</p>
        </div>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-secondary/20 p-10 text-center shadow-soft">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">{t("findStaff.whyTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="text-3xl font-bold text-primary mb-2">0%</div>
            <p className="text-gray-600">{t("findStaff.noFees")}</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-2">24/7</div>
            <p className="text-gray-600">{t("findStaff.access24")}</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-primary mb-2">48h</div>
            <p className="text-gray-600">{t("findStaff.pay48")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
