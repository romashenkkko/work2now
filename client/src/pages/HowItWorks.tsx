import { useTranslation } from "react-i18next";

export default function HowItWorks() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-12">{t("howItWorksPage.title")}</h1>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="flex gap-4">
          <span className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center">1</span>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">{t("howItWorksPage.step1")}</h3>
            <p className="text-gray-600 text-sm">{t("howItWorksPage.step1Desc")}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <span className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center">2</span>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">{t("howItWorksPage.step2")}</h3>
            <p className="text-gray-600 text-sm">{t("howItWorksPage.step2Desc")}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <span className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center">3</span>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">{t("howItWorksPage.step3")}</h3>
            <p className="text-gray-600 text-sm">{t("howItWorksPage.step3Desc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
