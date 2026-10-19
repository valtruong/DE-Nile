import nodemailer from "nodemailer";

// Sends verification emails.
//
// With SMTP_HOST set, it sends real email through that server
// (e.g. a Gmail account with an app password). Without it --
// the normal case on a laptop -- it prints the email to the
// backend terminal so you can copy the code from there.
//
//   SMTP_HOST=smtp.gmail.com SMTP_PORT=465
//   SMTP_USER=you@gmail.com SMTP_PASS=<app password>
//   MAIL_FROM="DE-Nile <you@gmail.com>"
export function createMailer(env = process.env) {
  if (!env.SMTP_HOST) {
    return {
      kind: "console",
      async send({ to, subject, text }) {
        console.log(
          [
            "",
            "──── email (not sent: SMTP_HOST is not set) ────",
            `To: ${to}`,
            `Subject: ${subject}`,
            "",
            text,
            "───────────────────────────────────────────────",
            ""
          ].join("\n")
        );
      }
    };
  }

  const port = Number(env.SMTP_PORT ?? 465);
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined
  });

  return {
    kind: "smtp",
    async send({ to, subject, text }) {
      await transport.sendMail({
        from: env.MAIL_FROM ?? env.SMTP_USER,
        to,
        subject,
        text
      });
    }
  };
}

export function verificationEmail(name, code) {
  return {
    subject: `Your DE-Nile code: ${code}`,
    text: [
      `Hi ${name},`,
      "",
      `Your DE-Nile verification code is ${code}.`,
      "It expires in 15 minutes.",
      "",
      "If you didn't create a DE-Nile account, ignore this email."
    ].join("\n")
  };
}

export function passwordResetEmail(name, code) {
  return {
    subject: `Your DE-Nile password reset code: ${code}`,
    text: [
      `Hi ${name},`,
      "",
      `Your DE-Nile password reset code is ${code}.`,
      "It expires in 15 minutes.",
      "",
      "If you didn't ask to reset your password, ignore this email. Your password won't change."
    ].join("\n")
  };
}
