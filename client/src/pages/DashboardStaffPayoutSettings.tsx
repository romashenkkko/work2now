import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { payoutAccountsApi, type StaffPayoutAccountDto } from "../api/client";

export default function DashboardStaffPayoutSettings() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<StaffPayoutAccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");

  const load = () => {
    setLoading(true);
    payoutAccountsApi
      .list()
      .then((r) => {
        setAccounts(r.accounts ?? []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Eroare"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onSaveIban = async () => {
    setSaving(true);
    setError(null);
    try {
      await payoutAccountsApi.upsert({
        type: "iban",
        beneficiaryName: beneficiaryName.trim(),
        iban: iban.trim(),
        bankName: bankName.trim() || undefined,
      });
      setBeneficiaryName("");
      setIban("");
      setBankName("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  const primary = accounts[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        {t("dashboard.staffPayoutSettingsTitle", "Cont plată staff")}
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        {t(
          "dashboard.staffPayoutSettingsIntro",
          "Adaugă IBAN-ul tău pentru plăți automate după ce clientul confirmă finalizarea. Un administrator verifică datele înainte de prima plată."
        )}
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">{t("dashboard.loading", "Se încarcă...")}</p>
      ) : primary ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1">{t("dashboard.status", "Status")}</p>
          <p className="text-sm font-medium text-gray-900 mb-2">{primary.status}</p>
          <p className="text-sm text-gray-700">
            <span className="text-gray-500">{t("dashboard.beneficiary", "Beneficiar")}: </span>
            {primary.beneficiaryName}
          </p>
          {primary.iban && (
            <p className="text-sm text-gray-700 font-mono mt-1">
              <span className="text-gray-500">IBAN: </span>
              {primary.iban}
            </p>
          )}
          {primary.rejectionReason && (
            <p className="text-sm text-rose-700 mt-2">{primary.rejectionReason}</p>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-4">
          {t("dashboard.staffPayoutIbanForm", "Actualizează IBAN")}
        </h2>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("dashboard.beneficiary", "Nume beneficiar")}
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
          value={beneficiaryName}
          onChange={(e) => setBeneficiaryName(e.target.value)}
          placeholder={primary?.beneficiaryName ?? ""}
        />
        <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono mb-3"
          value={iban}
          onChange={(e) => setIban(e.target.value)}
          placeholder={primary?.iban ?? "MD00..."}
        />
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t("dashboard.bankNameOptional", "Bancă (opțional)")}
        </label>
        <input
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSaveIban()}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "..." : t("dashboard.save", "Salvează")}
        </button>
      </div>
    </div>
  );
}
