import { useTranslation } from "react-i18next";

export default function About() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t("about.title")}</h1>
      <p className="text-gray-600 mb-12 max-w-3xl leading-relaxed">{t("about.lead")}</p>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h3 className="font-bold text-gray-900 mb-2">{t("about.smartProfile")}</h3>
          <p className="text-gray-600 text-sm">{t("about.smartProfileDesc")}</p>
        </div>
        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h3 className="font-bold text-gray-900 mb-2">{t("about.flexJobs")}</h3>
          <p className="text-gray-600 text-sm">{t("about.flexJobsDesc")}</p>
        </div>
        <div className="p-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
          <h3 className="font-bold text-gray-900 mb-2">{t("about.zeroBurocracy")}</h3>
          <p className="text-gray-600 text-sm">{t("about.zeroBurocracyDesc")}</p>
        </div>
      </div>
    </div>
  );
}
