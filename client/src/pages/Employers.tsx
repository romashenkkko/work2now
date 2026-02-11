import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Employers() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-6">{t("employers.title")}</h1>
          <p className="text-gray-600 mb-8 leading-relaxed">{t("employers.lead")}</p>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-center gap-2">✓ {t("employers.bullet1")}</li>
            <li className="flex items-center gap-2">✓ {t("employers.bullet2")}</li>
            <li className="flex items-center gap-2">✓ {t("employers.bullet3")}</li>
          </ul>
        </div>
        <div className="p-8 rounded-2xl border border-primary/20 bg-white shadow-lg">
          <h3 className="font-bold text-xl text-gray-900 mb-3">{t("employers.benefitsTitle")}</h3>
          <p className="text-gray-600 mb-6">{t("employers.benefitsLead")}</p>
          <Link to="/contact" className="inline-block px-6 py-3 rounded-xl border-2 border-primary text-primary font-semibold hover:bg-primary/5">
            {t("employers.discuss")}
          </Link>
        </div>
      </div>
    </div>
  );
}
