const nodemailer = require('nodemailer');

// Check if email is properly configured
const isEmailConfigured = process.env.MAIL_HOST && 
  process.env.MAIL_USER && 
  process.env.MAIL_PASSWORD && 
  !process.env.MAIL_PASSWORD.includes('***');

let transporter = null;
if (isEmailConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

const sendInviteEmail = async (toEmail, inviterName, ideaTitle) => {
  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM}>`,
    to: toEmail,
    subject: `${inviterName} invited you to collaborate on ID8`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 40px 20px; }
          .container { max-width: 500px; margin: 0 auto; }
          .logo { text-align: center; margin-bottom: 24px; }
          .logo img { height: 40px; }
          .card { background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          h1 { color: #000; margin: 0 0 16px 0; font-size: 24px; font-weight: 700; }
          p { color: #333; line-height: 1.6; margin: 12px 0; font-size: 15px; }
          .idea-title { color: #000; font-weight: 600; font-size: 16px; padding: 12px 16px; background: #f8f8f8; border-radius: 8px; border-left: 4px solid #FFD600; }
          .button { display: inline-block; background: #FFD600; color: #000 !important; padding: 14px 28px; border-radius: 8px; text-decoration: none !important; font-weight: 600; margin-top: 20px; }
          .footer { margin-top: 24px; font-size: 12px; color: #888; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <img src="https://id8.unobtuse.com/id8-logo-lightmode.png" alt="ID8" />
          </div>
          <div class="card">
            <h1>You're Invited!</h1>
            <p><strong>${inviterName}</strong> has invited you to collaborate on an idea:</p>
            <p class="idea-title">${ideaTitle}</p>
            <p>Open ID8 to view and respond to this invitation.</p>
            <a href="https://id8.unobtuse.com" class="button" style="color: #000 !important; text-decoration: none !important;">Open ID8</a>
          </div>
          <p class="footer">This email was sent by ID8. If you didn't expect this invitation, you can ignore this email.</p>
        </div>
      </body>
      </html>
    `,
  };

  if (!transporter) {
    console.log(`Email not configured - skipping invite email to ${toEmail}`);
    return false;
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Invite email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send invite email:', error);
    return false;
  }
};

module.exports = { sendInviteEmail };
