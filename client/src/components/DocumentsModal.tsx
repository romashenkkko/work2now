import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";

export type DocItem = { id: string; file: File; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onAttach: (files: DocItem[]) => void;
  existing: DocItem[];
};

export default function DocumentsModal({ open, onClose, onAttach, existing }: Props) {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<DocItem[]>(() => [...existing]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleAdd = () => inputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newDocs: DocItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newDocs.push({
        id: `doc-${Date.now()}-${i}`,
        file,
        name: file.name.replace(/\.[^/.]+$/, "") || file.name,
      });
    }
    setDocs((prev) => [...prev, ...newDocs]);
    e.target.value = "";
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAttach = () => {
    const toAttach = docs.filter((d) => selected.has(d.id));
    onAttach(toAttach);
    onClose();
  };

  const handleBack = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 modal-overlay-enter" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col modal-content-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900">{t("dashboard.myDocuments")}</h3>
          <button
            type="button"
            onClick={handleAdd}
            className="p-2 rounded-xl bg-primary text-white hover:bg-primary-dark font-bold text-xl leading-none"
            aria-label={t("dashboard.addDocuments")}
          >
            +
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-sm text-gray-500 px-4 pt-2 pb-1 flex-shrink-0">{t("dashboard.selectDocumentsHint")}</p>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {docs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {t("dashboard.noDocumentsYet")}
            </div>
          ) : (
            docs.map((doc) => {
              const isPdf = doc.file.type.includes("pdf");
              const isSelected = selected.has(doc.id);
              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-gray-200 bg-gray-50/80"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(doc.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <span className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                      {isPdf ? (
                        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" /></svg>
                      ) : (
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{doc.file.name}</p>
                      <p className="text-xs text-gray-500 truncate">{doc.name}</p>
                    </div>
                    {isSelected && (
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDoc(doc.id)}
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                    aria-label={t("dashboard.remove")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="flex gap-3 p-4 border-t border-gray-100 flex-shrink-0">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("dashboard.back")}
          </button>
          <button
            type="button"
            onClick={handleAttach}
            disabled={selected.size === 0}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white font-medium hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("dashboard.attach")}
          </button>
        </div>
      </div>
    </div>
  );
}
