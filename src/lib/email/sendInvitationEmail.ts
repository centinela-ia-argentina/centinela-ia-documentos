import 'server-only';

interface SendInvitationEmailParams {
  to: string;
  invitationUrl: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendInvitationEmail({
  to,
  invitationUrl,
}: SendInvitationEmailParams) {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.error('Invitation email not sent: RESEND_API_KEY is not configured.');
    return;
  }

  const safeInvitationUrl = escapeHtml(invitationUrl);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Anulus AI <onboarding@resend.dev>',
        to: [to],
        subject: 'Te invitaron a Anulus AI',
        text: `Te invitaron a formar parte de Anulus AI. Aceptá la invitación desde este enlace: ${invitationUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
            <h1 style="font-size: 24px; margin-bottom: 16px;">Te invitaron a Anulus AI</h1>
            <p>Recibiste una invitación para acceder a la plataforma.</p>
            <p>
              <a
                href="${safeInvitationUrl}"
                style="display: inline-block; margin-top: 12px; padding: 12px 18px; border-radius: 12px; background: #0ea5e9; color: #ffffff; font-weight: 700; text-decoration: none;"
              >
                Aceptar invitación
              </a>
            </p>
            <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
              Si no esperabas esta invitación, podés ignorar este correo.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      console.error('Invitation email delivery failed:', response.status, responseBody);
    }
  } catch (error) {
    console.error('Invitation email delivery error:', error);
  }
}
