/**
 * Copiere în clipboard: încearcă Clipboard API, apoi execCommand (merge pe HTTP / LAN unde API-ul e blocat).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const t = String(text ?? "");
  if (!t) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    // fallback
  }
  return copyTextToClipboardFallback(t);
}

function copyTextToClipboardFallback(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
