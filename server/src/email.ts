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

/** Job details for email notification */
export type JobDetailsForEmail = {
  title: string;
  category?: string;
  location?: string;
  date?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  hourlyRate?: number | null;
};

/** Notificare către angajat (staff): customerul l-a acceptat pe job. */
export async function notifyStaffAccepted(
  staffEmail: string,
  staffName: string,
  jobDetails: JobDetailsForEmail | string
): Promise<void> {
  if (!staffEmail?.trim()) return;
  
  // Backward compatibility: if jobDetails is a string, treat it as jobTitle
  const details: JobDetailsForEmail = typeof jobDetails === "string" 
    ? { title: jobDetails }
    : jobDetails;
  
  const subject = `[Work2Now] Ai fost acceptat pentru jobul „${details.title}”`;
  
  // Format date range
  let dateStr = "";
  if (details.date) {
    const startDate = new Date(details.date);
    if (details.endDate && details.endDate !== details.date) {
      const endDate = new Date(details.endDate);
      dateStr = `${startDate.toLocaleDateString("ro-RO")} - ${endDate.toLocaleDateString("ro-RO")}`;
    } else {
      dateStr = startDate.toLocaleDateString("ro-RO");
    }
  }
  
  // Format time range
  let timeStr = "";
  if (details.startTime && details.endTime) {
    timeStr = `${details.startTime} - ${details.endTime}`;
  } else if (details.startTime) {
    timeStr = details.startTime;
  }
  
  // Plain text version
  const text = `Bună ziua, ${staffName},

Felicitări! Ai fost acceptat pentru jobul „${details.title}” pe Work2Now.

${details.category ? `Categorie: ${details.category}\n` : ""}${dateStr ? `Data: ${dateStr}\n` : ""}${timeStr ? `Ora: ${timeStr}\n` : ""}${details.location ? `Locația: ${details.location}\n` : ""}${details.hourlyRate ? `Tarif orar: ${details.hourlyRate.toFixed(2)} MDL/oră\n` : ""}
Conectează-te la platformă pentru detalii complete și pentru check-in la începutul programului.

Echipa Work2Now`;

  // HTML version with professional styling
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: linear-gradient(135deg, #7a63f1 0%, #5a4fcf 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Work2Now</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1e1c2f; font-size: 24px; font-weight: 600;">
                Felicitări, ${staffName}!
              </h2>
              
              <p style="margin: 0 0 30px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Ai fost acceptat pentru jobul <strong style="color: #7a63f1;">„${details.title}"</strong> pe Work2Now.
              </p>
              
              <!-- Job Details Card -->
              <div style="background-color: #f7fafc; border-left: 4px solid #7a63f1; padding: 20px; border-radius: 8px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px; color: #1e1c2f; font-size: 18px; font-weight: 600;">Detalii job</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  ${details.category ? `
                  <tr>
                    <td style="padding: 8px 0; color: #718096; font-size: 14px; width: 120px;">Categorie:</td>
                    <td style="padding: 8px 0; color: #1e1c2f; font-size: 14px; font-weight: 500;">${details.category}</td>
                  </tr>` : ""}
                  ${dateStr ? `
                  <tr>
                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">Data:</td>
                    <td style="padding: 8px 0; color: #1e1c2f; font-size: 14px; font-weight: 500;">${dateStr}</td>
                  </tr>` : ""}
                  ${timeStr ? `
                  <tr>
                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">Ora:</td>
                    <td style="padding: 8px 0; color: #1e1c2f; font-size: 14px; font-weight: 500;">${timeStr}</td>
                  </tr>` : ""}
                  ${details.location ? `
                  <tr>
                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">Locația:</td>
                    <td style="padding: 8px 0; color: #1e1c2f; font-size: 14px; font-weight: 500;">${details.location}</td>
                  </tr>` : ""}
                  ${details.hourlyRate ? `
                  <tr>
                    <td style="padding: 8px 0; color: #718096; font-size: 14px;">Tarif orar:</td>
                    <td style="padding: 8px 0; color: #1e1c2f; font-size: 14px; font-weight: 500;">${details.hourlyRate.toFixed(2)} MDL/oră</td>
                  </tr>` : ""}
                </table>
              </div>
              
              <p style="margin: 30px 0 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Conectează-te la platformă pentru detalii complete și pentru check-in la începutul programului.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || "https://work2now.com"}/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #7a63f1; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accesează platforma</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #718096; font-size: 14px;">
                Echipa Work2Now<br>
                <a href="${process.env.FRONTEND_URL || "https://work2now.com"}" style="color: #7a63f1; text-decoration: none;">work2now.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendMail(staffEmail, subject, text, html);
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

/** Email de confirmare – utilizatorul a acceptat Termenii și Condițiile Work2Now SRL. */
export async function sendTermsAcceptanceEmail(
  userEmail: string,
  userName: string
): Promise<void> {
  if (!userEmail?.trim()) return;
  const subject = `[Work2Now SRL] Confirmare acceptare Termeni și Condiții`;
  const text = `${userName} has accepted the Work2Now SRL Terms and Conditions.

Data și ora acceptării: ${new Date().toISOString()}

Dacă acest mesaj nu vă este destinat, vă rugăm să îl ignorați și să ne contactați imediat.

Echipa Work2Now SRL`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-collapse: collapse;">
          <tr>
            <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #7a63f1 0%, #5a4fcf 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Work2Now SRL</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1e1c2f; font-size: 24px;">Confirmare acceptare Termeni și Condiții</h2>
              <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                <strong>${userName}</strong> has accepted the Work2Now SRL Terms and Conditions.
              </p>
              <p style="margin: 0 0 20px; color: #718096; font-size: 14px;">
                Data și ora: ${new Date().toLocaleString("ro-RO")}
              </p>
              <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Dacă acest mesaj nu vă este destinat, vă rugăm să îl ignorați și să ne contactați imediat la echipa Work2Now.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #f7fafc; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #718096; font-size: 14px;">Echipa Work2Now SRL</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendMail(userEmail, subject, text, html);
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
