import nodemailer from "nodemailer";

const SMTP_USER = process.env.SMTP_USER ?? process.env.GMAIL_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? process.env.GMAIL_APP_PASSWORD ?? "";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[Email] SMTP_USER / SMTP_PASS (sau GMAIL_USER / GMAIL_APP_PASSWORD) neconfigurate – notificările pe email sunt dezactivate.");
    return null;
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  return transporter;
}

/** Trimite email. Nu aruncă eroare dacă SMTP nu e configurat sau trimiterea eșuează (doar log). */
async function sendMail(to: string, subject: string, text: string, html?: string): Promise<void> {
  const trans = getTransporter();
  if (!trans) return;
  try {
    await trans.sendMail({
      from: SMTP_USER,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });
    console.log("[Email] Trimis către", to, "–", subject);
  } catch (err) {
    console.warn("[Email] Eroare la trimitere către", to, ":", (err as Error).message);
  }
}

/** Notificare către customer: un angajat a trimis cerere la job. */
export async function notifyCustomerNewApplication(
  customerEmail: string,
  staffName: string,
  jobTitle: string
): Promise<void> {
  if (!customerEmail?.trim()) return;
  const subject = `[Work2Now] Nouă cerere pentru jobul „${jobTitle}”`;
  const text = `Bună ziua,\n\n${staffName} a trimis o cerere pentru jobul „${jobTitle}” pe Work2Now.\n\nConectează-te la platformă pentru a vedea aplicația și a accepta sau refuza.\n\nEchipa Work2Now`;
  await sendMail(customerEmail, subject, text);
}

/** Notificare către angajat (staff): customerul l-a acceptat pe job. */
export async function notifyStaffAccepted(
  staffEmail: string,
  staffName: string,
  jobTitle: string
): Promise<void> {
  if (!staffEmail?.trim()) return;
  const subject = `[Work2Now] Ai fost acceptat pentru jobul „${jobTitle}”`;
  const text = `Bună ziua, ${staffName},\n\nAi fost acceptat pentru jobul „${jobTitle}” pe Work2Now.\n\nConectează-te la platformă pentru detalii și pentru check-in la începutul programului.\n\nEchipa Work2Now`;
  await sendMail(staffEmail, subject, text);
}

/** Notificare către angajat (staff): customerul a refuzat aplicația. */
export async function notifyStaffRefused(
  staffEmail: string,
  staffName: string,
  jobTitle: string
): Promise<void> {
  if (!staffEmail?.trim()) return;
  const subject = `[Work2Now] Aplicația pentru jobul „${jobTitle}” nu a fost acceptată`;
  const text = `Bună ziua, ${staffName},\n\nDin păcate, aplicația ta pentru jobul „${jobTitle}” pe Work2Now nu a fost acceptată de angajator.\n\nPoți căuta alte joburi disponibile pe platformă.\n\nEchipa Work2Now`;
  await sendMail(staffEmail, subject, text);
}

/** Email de test – verifică că SMTP funcționează. */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  const t = to?.trim();
  if (!t) return { ok: false, error: "Adresa de email lipsește." };
  const trans = getTransporter();
  if (!trans) return { ok: false, error: "SMTP neconfigurat (SMTP_USER / SMTP_PASS)." };
  try {
    await trans.sendMail({
      from: SMTP_USER,
      to: t,
      subject: "[Work2Now] Email de test",
      text: "Acesta este un email de test de la Work2Now. Notificările pe Gmail sunt configurate corect.",
      html: "<p>Acesta este un email de test de la <strong>Work2Now</strong>.</p><p>Notificările pe Gmail sunt configurate corect.</p>",
    });
    console.log("[Email] Test trimis către", t);
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    console.warn("[Email] Eroare test:", msg);
    return { ok: false, error: msg };
  }
}
