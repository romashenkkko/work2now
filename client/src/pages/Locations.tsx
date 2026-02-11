import { useTranslation } from "react-i18next";

export default function Locations() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-12">{t("locations.title")}</h1>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="p-8 rounded-2xl border border-gray-200 bg-white shadow-lg">
          <h3 className="font-bold text-xl text-gray-900 mb-3">{t("locations.moldova")}</h3>
          <p className="text-gray-600">{t("locations.moldovaDesc")}</p>
        </div>
        <div className="p-8 rounded-2xl border border-gray-200 bg-white shadow-lg">
          <h3 className="font-bold text-xl text-gray-900 mb-3">{t("locations.romania")}</h3>
          <p className="text-gray-600">{t("locations.romaniaDesc")}</p>
        </div>
      </div>
    </div>
  );
}
