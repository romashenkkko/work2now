import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CircleHelp,
  CreditCard,
  Info,
  Landmark,
  Save,
  Shield,
  Upload,
} from "lucide-react";
import { payoutAccountsApi, type StaffPayoutAccountDto } from "../api/client";
import {
  formatIbanDisplay,
  normalizeIban,
  validatePayoutIbanForm,
  type PayoutFieldErrors,
} from "../lib/payoutIbanValidation";

type Props = {
  embedded?: boolean;
  onBack?: () => void;
};

type Touched = {
  beneficiaryName: boolean;
  iban: boolean;
  bankName: boolean;
};

function FieldLabel({
  id,
  label,
  optional,
  hint,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-800">
        {label}
        {optional ? <span className="text-gray-400 font-normal"> ({optional})</span> : null}
      </label>
      {hint ? (
        <span className="text-gray-400" title={hint}>
          <Info className="w-3.5 h-3.5" aria-hidden />
        </span>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary";
const inputOk = "border-gray-200";
const inputErr = "border-red-400 focus:ring-red-200 focus:border-red-400";

export default function DashboardStaffPayoutSettings({ embedded = false, onBack }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<StaffPayoutAccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [touched, setTouched] = useState<Touched>({
    beneficiaryName: false,
    iban: false,
    bankName: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const validationMessages = useMemo(
    () => ({
      beneficiaryRequired: t("profile.payout.beneficiaryRequired"),
      beneficiaryTooShort: t("profile.payout.beneficiaryTooShort"),
      beneficiaryInvalid: t("profile.payout.beneficiaryInvalid"),
      ibanRequired: t("profile.payout.ibanRequired"),
      ibanInvalid: t("profile.payout.ibanInvalid"),
      bankTooLong: t("profile.payout.bankTooLong"),
    }),
    [t]
  );

  const load = () => {
    setLoading(true);
    payoutAccountsApi
      .list()
      .then((r) => {
        setAccounts(r.accounts ?? []);
        setSaveError(null);
      })
      .catch((e) => setSaveError(e instanceof Error ? e.message : "Eroare"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const primary = accounts[0];

  useEffect(() => {
    if (!primary) return;
    setBeneficiaryName((v) => v || primary.beneficiaryName || "");
    setIban((v) => v || formatIbanDisplay(primary.iban || ""));
    setBankName((v) => v || primary.bankName || "");
  }, [primary?.id, primary?.beneficiaryName, primary?.iban, primary?.bankName]);

  const fieldErrors: PayoutFieldErrors = useMemo(
    () => validatePayoutIbanForm(beneficiaryName, iban, bankName, validationMessages),
    [beneficiaryName, iban, bankName, validationMessages]
  );

  const showError = (field: keyof Touched) =>
    (submitAttempted || touched[field]) && fieldErrors[field];

  const onSaveIban = async () => {
    setSubmitAttempted(true);
    setTouched({ beneficiaryName: true, iban: true, bankName: true });

    const errors = validatePayoutIbanForm(beneficiaryName, iban, bankName, validationMessages);
    if (Object.keys(errors).length > 0) return;

    const name = beneficiaryName.trim();
    const ibanVal = normalizeIban(iban);
    const bank = bankName.trim();

    setSaving(true);
    setSaveError(null);
    try {
      await payoutAccountsApi.upsert({
        type: "iban",
        beneficiaryName: name,
        iban: ibanVal,
        bankName: bank || undefined,
      });
      setSubmitAttempted(false);
      setTouched({ beneficiaryName: false, iban: false, bankName: false });
      load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  const statusBadgeClass = (status: string) => {
    const s = status.toLowerCase();
    if (s === "verified") return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (s === "rejected") return "bg-red-50 text-red-800 border-red-200";
    if (s === "submitted") return "bg-amber-50 text-amber-800 border-amber-200";
    return "bg-gray-50 text-gray-700 border-gray-200";
  };

  const body = (
    <div className={embedded ? "w-full" : "max-w-6xl mx-auto px-4 py-6"}>
      {embedded && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary mb-5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("profile.back")}
        </button>
      )}

      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {t("dashboard.staffPayoutSettingsTitle", "Cont plată staff")}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-3xl leading-relaxed">
          {t(
            "dashboard.staffPayoutSettingsIntro",
            "Adaugă IBAN-ul tău pentru plăți automate după ce clientul confirmă finalizarea. Un administrator verifică datele înainte de prima plată."
          )}
        </p>
      </header>

      {saveError && (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2 space-y-6">
          {!loading && primary ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t("dashboard.status", "Status cont")}
                </p>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(primary.status)}`}
                >
                  {primary.status}
                </span>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-gray-500">{t("dashboard.beneficiary", "Beneficiar")}</dt>
                  <dd className="font-medium text-gray-900">{primary.beneficiaryName}</dd>
                </div>
                {primary.iban ? (
                  <div>
                    <dt className="text-gray-500">IBAN</dt>
                    <dd className="font-mono font-medium text-gray-900 break-all">{formatIbanDisplay(primary.iban)}</dd>
                  </div>
                ) : null}
              </dl>
              {primary.rejectionReason ? (
                <p className="mt-3 text-sm text-red-700 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  {primary.rejectionReason}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 px-5 sm:px-8 py-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("dashboard.staffPayoutIbanForm", "Actualizează IBAN")}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {t("profile.payout.formSubtitle", "Completează datele contului tău bancar pentru încasări.")}
                </p>
              </div>
            </div>

            <div className="px-5 sm:px-8 py-6 space-y-5">
              {loading ? (
                <p className="text-sm text-gray-500 py-8 text-center">{t("dashboard.loading", "Se încarcă...")}</p>
              ) : (
                <>
                  <div>
                    <FieldLabel
                      id="payout-beneficiary"
                      label={t("dashboard.beneficiary", "Nume beneficiar")}
                      hint={t("profile.payout.beneficiaryHint")}
                    />
                    <input
                      id="payout-beneficiary"
                      className={`${inputBase} ${showError("beneficiaryName") ? inputErr : inputOk}`}
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      onBlur={() => setTouched((x) => ({ ...x, beneficiaryName: true }))}
                      placeholder={t("profile.payout.beneficiaryPlaceholder", "Ex.: Ion Popescu")}
                      autoComplete="name"
                    />
                    {showError("beneficiaryName") ? (
                      <p className="mt-1.5 text-xs text-red-600">{fieldErrors.beneficiaryName}</p>
                    ) : null}
                  </div>

                  <div>
                    <FieldLabel id="payout-iban" label="IBAN" hint={t("profile.payout.ibanHint")} />
                    <input
                      id="payout-iban"
                      className={`${inputBase} font-mono tracking-wide ${showError("iban") ? inputErr : inputOk}`}
                      value={iban}
                      onChange={(e) => setIban(e.target.value.toUpperCase())}
                      onBlur={() => {
                        setTouched((x) => ({ ...x, iban: true }));
                        setIban((v) => formatIbanDisplay(v));
                      }}
                      placeholder="MD00 …"
                      spellCheck={false}
                    />
                    {showError("iban") ? (
                      <p className="mt-1.5 text-xs text-red-600">{fieldErrors.iban}</p>
                    ) : (
                      <p className="mt-1.5 text-xs text-gray-500">{t("profile.payout.ibanFormatHint")}</p>
                    )}
                  </div>

                  <div>
                    <FieldLabel
                      id="payout-bank"
                      label={t("dashboard.bankNameOptional", "Bancă")}
                      optional={t("profile.payout.optional", "opțional")}
                      hint={t("profile.payout.bankHint")}
                    />
                    <input
                      id="payout-bank"
                      className={`${inputBase} ${showError("bankName") ? inputErr : inputOk}`}
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      onBlur={() => setTouched((x) => ({ ...x, bankName: true }))}
                      placeholder={t("profile.payout.bankPlaceholder", "Ex.: MAIB, Victoriabank")}
                    />
                    {showError("bankName") ? (
                      <p className="mt-1.5 text-xs text-red-600">{fieldErrors.bankName}</p>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-gray-100 px-5 sm:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-50/80">
              <p className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                {t("profile.payout.securityNote", "Datele tale sunt în siguranță și utilizate doar pentru plăți.")}
              </p>
              <button
                type="button"
                disabled={saving || loading}
                onClick={() => void onSaveIban()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-primary-dark disabled:opacity-50 transition-colors shrink-0"
              >
                <Save className="w-4 h-4" />
                {saving ? t("profile.payout.saving", "Se salvează…") : t("dashboard.save", "Salvează")}
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("profile.payout.verifyTitle", "Verificare manuală înainte de prima plată")}
                </h3>
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  {t(
                    "profile.payout.verifyBody",
                    "Datele bancare sunt verificate de un administrator. Vei fi notificat(ă) după aprobare."
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              {t("profile.payout.howItWorks", "Cum funcționează")}
            </h3>
            <ol className="space-y-4">
              {[
                {
                  icon: Upload,
                  title: t("profile.payout.step1Title", "Adaugă datele"),
                  desc: t("profile.payout.step1Desc", "Completează IBAN-ul și numele beneficiarului."),
                },
                {
                  icon: Shield,
                  title: t("profile.payout.step2Title", "Verificare"),
                  desc: t("profile.payout.step2Desc", "Un administrator confirmă contul."),
                },
                {
                  icon: CreditCard,
                  title: t("profile.payout.step3Title", "Plăți automate"),
                  desc: t("profile.payout.step3Desc", "Primești banii după finalizarea jobului."),
                },
              ].map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                      <step.icon className="w-4 h-4" />
                    </div>
                    {i < 2 ? <span className="w-px flex-1 min-h-[12px] bg-gray-200 my-1" /> : null}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-medium text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-5 rounded-xl bg-primary/5 border border-primary/10 p-4">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <CircleHelp className="w-4 h-4 text-primary" />
                {t("profile.payout.needHelp", "Ai nevoie de ajutor?")}
              </p>
              <button
                type="button"
                onClick={() => navigate("/dashboard/chat")}
                className="mt-2 text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
              >
                {t("profile.payout.contactSupport", "Contactează suportul →")}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );

  if (embedded) {
    return body;
  }

  return body;
}
