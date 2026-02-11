import { useTranslation } from "react-i18next";

export default function AppPage() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t("appPage.title")}</h1>
      <p className="text-gray-600 mb-10 max-w-3xl leading-relaxed">{t("appPage.lead")}</p>
      <div className="flex flex-wrap gap-4">
        <span className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary font-semibold">{t("appPage.ios")}</span>
        <span className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary font-semibold">{t("appPage.android")}</span>
        <span className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary font-semibold">{t("appPage.notifications")}</span>
        <span className="px-5 py-2.5 rounded-xl bg-primary/10 text-primary font-semibold">{t("appPage.salaryMgmt")}</span>
      </div>
    </div>
  );
}
