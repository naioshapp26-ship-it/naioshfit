/**
 * Email Service Module
 * Centralized email sending functionality using Nodemailer
 */

import nodemailer from 'nodemailer';
import type { Request } from 'express';
import type { Pool } from 'pg';
import { getEmailConfigForScope } from './emailSettings';
import { pool as centralPool } from '../db';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string | null;
  useTls: boolean;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface EmailScopeContext {
  tenantPool?: Pool | null;
}

const BRANDING_LOGO_QUERY = 'SELECT logo_url FROM branding_settings ORDER BY id ASC LIMIT 1';

const isRequestLike = (context: Request | EmailScopeContext | undefined): context is Request => {
  if (!context) return false;
  return typeof (context as Request).get === 'function';
};

const escapeHtmlAttribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function resolveFrontendBaseUrl(context?: Request | EmailScopeContext): string {
  const envUrl = process.env.FRONTEND_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (isRequestLike(context)) {
    const forwardedProto = context.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const host = context.get('x-forwarded-host')?.split(',')[0]?.trim() || context.get('host');
    if (host) {
      const protocol = forwardedProto || (context.secure ? 'https' : 'http');
      return `${protocol}://${host}`.replace(/\/+$/, '');
    }
  }

  return 'http://localhost:5000';
}

const toAbsoluteAssetUrl = (assetUrl: string, baseUrl: string): string => {
  if (/^https?:\/\//i.test(assetUrl)) return assetUrl;
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = assetUrl.startsWith('/') ? assetUrl : `/${assetUrl}`;
  return `${normalizedBase}${normalizedPath}`;
};

const fetchBrandingLogoFromPool = async (dbPool: Pick<Pool, 'query'>): Promise<string | null> => {
  try {
    const result = await dbPool.query(BRANDING_LOGO_QUERY);
    const raw = result.rows?.[0]?.logo_url;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    return null;
  } catch (error: any) {
    // Skip gracefully if branding table/column is not yet migrated.
    if (error?.code === '42P01' || error?.code === '42703') {
      return null;
    }
    throw error;
  }
};

const getBrandingLogoForEmail = async (context?: Request | EmailScopeContext): Promise<string | null> => {
  try {
    const tenantPoolFromRequest = isRequestLike(context)
      ? ((context as any).tenantPool as Pool | undefined)
      : undefined;
    const tenantPoolFromScope = !isRequestLike(context)
      ? (context?.tenantPool as Pool | undefined)
      : undefined;
    const tenantPool = tenantPoolFromRequest || tenantPoolFromScope;

    if (tenantPool) {
      const tenantLogo = await fetchBrandingLogoFromPool(tenantPool);
      return tenantLogo;
    }

    return await fetchBrandingLogoFromPool(centralPool);
  } catch (error) {
    console.warn('[EMAIL] Failed to resolve branding logo for email:', error);
    return null;
  }
};

/**
 * Get SMTP configuration from scoped database settings
 */
export async function getEmailConfig(context?: Request | EmailScopeContext): Promise<EmailConfig | null> {
  const config = await getEmailConfigForScope(context);
  if (!config) {
    console.error('[EMAIL] SMTP configuration is incomplete in database settings.');
    return null;
  }

  return {
    host: config.host,
    port: config.port,
    user: config.user,
    pass: config.pass,
    from: config.from,
    to: config.to,
    useTls: config.useTls,
  };
}

/**
 * Send an email using the configured SMTP server
 */
export async function sendEmail(options: SendEmailOptions, context?: Request | EmailScopeContext): Promise<boolean> {
  const config = await getEmailConfig(context);
  
  if (!config) {
    console.error('[EMAIL] Cannot send email: SMTP not configured in database settings');
    return false;
  }

  try {
    // Enhanced SMTP configuration with better timeout and TLS handling
    const transportConfig: any = {
      host: config.host,
      port: config.port,
      secure: config.useTls && config.port === 465, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.pass,
      },
      // Connection timeout in milliseconds (default: 2 minutes)
      connectionTimeout: 60000, // 60 seconds
      // Socket timeout in milliseconds (default: 10 minutes)
      socketTimeout: 60000, // 60 seconds
      // Greeting timeout in milliseconds (default: 10 seconds)
      greetingTimeout: 30000, // 30 seconds
      // Enable logging for debugging (set to false in production if needed)
      logger: false,
      debug: false, // Set to true for detailed SMTP logs
    };

    // If port is not 465, enable STARTTLS
    if (config.useTls && config.port !== 465) {
      transportConfig.requireTLS = true; // Force TLS
      transportConfig.tls = {
        // Don't fail on invalid certs in development (remove in production if using valid certs)
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      };
    }

    console.log('[EMAIL] Creating SMTP transport:', {
      host: config.host,
      port: config.port,
      secure: transportConfig.secure,
      user: config.user.substring(0, 3) + '***', // Partial user for logging
    });

    const transporter = nodemailer.createTransport(transportConfig);

    // Verify connection before sending
    try {
      await transporter.verify();
      console.log('[EMAIL] SMTP connection verified successfully');
    } catch (verifyError: any) {
      console.error('[EMAIL] SMTP connection verification failed:', {
        error: verifyError.message,
        code: verifyError.code,
        command: verifyError.command,
      });
      throw new Error(`SMTP connection failed: ${verifyError.message}`);
    }

    await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('[EMAIL] Successfully sent email to:', options.to);
    return true;
  } catch (error: any) {
    console.error('[EMAIL] Failed to send email:', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
}

/**
 * Send a password reset email with bilingual content (Arabic + English)
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName: string,
  context?: Request | EmailScopeContext
): Promise<boolean> {
  const frontendUrl = resolveFrontendBaseUrl(context);
  const resetLink = `${frontendUrl}/reset?token=${resetToken}`;
  const brandingLogo = await getBrandingLogoForEmail(context);
  const emailLogoUrl = brandingLogo ? toAbsoluteAssetUrl(brandingLogo, frontendUrl) : null;
  const logoMarkup = emailLogoUrl
    ? `<img src="${escapeHtmlAttribute(emailLogoUrl)}" alt="Naiosh Fit" style="max-width: 110px; max-height: 110px; width: auto; height: auto; border-radius: 16px; box-shadow: 0 10px 25px rgba(127, 29, 29, 0.18); margin-bottom: 20px; background-color: #FFFFFF; padding: 10px;" />`
    : `<div style="background-color: #7F1D1D; width: 80px; height: 80px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 10px 25px rgba(127, 29, 29, 0.3); margin-bottom: 20px;"><span style="color: #FFFFFF; font-size: 32px; font-weight: bold; letter-spacing: -1px;">NF</span></div>`;
  
  // Bilingual subject
  const subject = 'إعادة تعيين كلمة المرور | Password Reset - Naiosh Fit';

  // Bilingual plain text email
  const text = `
مرحباً ${userName},

تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بك في Naiosh Fit.

لإعادة تعيين كلمة المرور، انقر على الرابط التالي:
${resetLink}

هذا الرابط صالح لمدة ساعة واحدة فقط.

إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.

---

Hello ${userName},

We received a request to reset your password for your Naiosh Fit account.

To reset your password, click on the following link:
${resetLink}

This link is valid for 1 hour only.

If you didn't request a password reset, you can safely ignore this email.

---

Naiosh Fit
https://naioshfit.com
  `.trim();

  // Bilingual HTML email with professional dark red design
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>إعادة تعيين كلمة المرور</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); min-height: 100vh;">
  <!-- Outer container with gradient background -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); min-height: 100vh; padding: 40px 20px;">
    <tr>
      <td align="center" valign="top">
        <!-- Main centered card container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <!-- Logo/Brand -->
              ${logoMarkup}
              <h1 style="margin: 15px 0 0 0; color: #7F1D1D; font-size: 28px; font-weight: 700; text-align: center; letter-spacing: -0.5px;">Naiosh Fit</h1>
            </td>
          </tr>
          <tr>
            <td>
              <!-- White card with shadow -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border-radius: 16px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15); overflow: hidden;">
                <!-- Red accent bar at top -->
                <tr>
                  <td style="background: linear-gradient(90deg, #991B1B 0%, #B91C1C 100%); height: 6px; padding: 0;"></td>
                </tr>
                
                <!-- Arabic Content -->
                <tr>
                  <td style="padding: 50px 40px 30px 40px;" dir="rtl">
                    <h2 style="color: #1F2937; font-size: 24px; font-weight: 700; margin: 0 0 24px 0; text-align: center;">مرحباً ${userName}! 👋</h2>
                    <p style="color: #4B5563; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0; text-align: right;">
                      تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في <strong style="color: #7F1D1D;">Naiosh Fit</strong>.
                    </p>
                    <p style="color: #4B5563; font-size: 16px; line-height: 1.8; margin: 0 0 32px 0; text-align: right;">
                      لإعادة تعيين كلمة المرور، يرجى النقر على الزر أدناه:
                    </p>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding: 0 0 32px 0;">
                          <a href="${resetLink}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(90deg, #991B1B 0%, #B91C1C 100%); color: #FFFFFF; text-decoration: none; border-radius: 12px; font-size: 17px; font-weight: 700; box-shadow: 0 8px 20px rgba(153, 27, 27, 0.3); transition: all 0.3s ease;">
                            إعادة تعيين كلمة المرور
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Alternative link section -->
                    <div style="background-color: #FEF2F2; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
                      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0; text-align: right;">
                        أو انسخ الرابط التالي والصقه في المتصفح:
                      </p>
                      <p style="color: #991B1B; font-size: 13px; word-break: break-all; margin: 0; direction: ltr; text-align: left; font-family: 'Courier New', monospace; background-color: #FFFFFF; padding: 12px; border-radius: 8px; border: 1px solid #FEE2E2;">
                        ${resetLink}
                      </p>
                    </div>
                    
                    <!-- Important notice -->
                    <div style="background-color: #FEF2F2; border-left: 4px solid #991B1B; padding: 16px 20px; margin: 0 0 20px 0; border-radius: 8px;">
                      <p style="color: #7F1D1D; font-size: 14px; line-height: 1.6; margin: 0; text-align: right;">
                        <strong>⏰ ملاحظة هامة:</strong> هذا الرابط صالح لمدة ساعة واحدة فقط.
                      </p>
                    </div>
                    
                    <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 0; text-align: right;">
                      إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان. حسابك محمي ولن يتم إجراء أي تغيير.
                    </p>
                  </td>
                </tr>

                <!-- Elegant Divider -->
                <tr>
                  <td style="padding: 0 40px;">
                    <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, #E5E7EB 20%, #E5E7EB 80%, transparent 100%);"></div>
                  </td>
                </tr>

                <!-- English Content -->
                <tr>
                  <td style="padding: 30px 40px 50px 40px;" dir="ltr">
                    <h2 style="color: #1F2937; font-size: 24px; font-weight: 700; margin: 0 0 24px 0; text-align: center;">Hello ${userName}! 👋</h2>
                    <p style="color: #4B5563; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
                      We received a request to reset the password for your <strong style="color: #7F1D1D;">Naiosh Fit</strong> account.
                    </p>
                    <p style="color: #4B5563; font-size: 16px; line-height: 1.8; margin: 0 0 32px 0;">
                      To reset your password, please click the button below:
                    </p>
                    
                    <!-- CTA Button -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding: 0 0 32px 0;">
                          <a href="${resetLink}" style="display: inline-block; padding: 16px 48px; background: linear-gradient(90deg, #991B1B 0%, #B91C1C 100%); color: #FFFFFF; text-decoration: none; border-radius: 12px; font-size: 17px; font-weight: 700; box-shadow: 0 8px 20px rgba(153, 27, 27, 0.3);">
                            Reset Password
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Alternative link section -->
                    <div style="background-color: #FEF2F2; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
                      <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="color: #991B1B; font-size: 13px; word-break: break-all; margin: 0; font-family: 'Courier New', monospace; background-color: #FFFFFF; padding: 12px; border-radius: 8px; border: 1px solid #FEE2E2;">
                        ${resetLink}
                      </p>
                    </div>
                    
                    <!-- Important notice -->
                    <div style="background-color: #FEF2F2; border-left: 4px solid #991B1B; padding: 16px 20px; margin: 0 0 20px 0; border-radius: 8px;">
                      <p style="color: #7F1D1D; font-size: 14px; line-height: 1.6; margin: 0;">
                        <strong>⏰ Important:</strong> This link is valid for 1 hour only.
                      </p>
                    </div>
                    
                    <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 0;">
                      If you didn't request a password reset, you can safely ignore this email. Your account is secure and no changes will be made.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 32px 40px; text-align: center; background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); border-top: 1px solid #FEE2E2;">
                    <p style="color: #9CA3AF; font-size: 13px; margin: 0 0 8px 0; line-height: 1.5;">
                      <strong style="color: #7F1D1D;">Naiosh Fit</strong> - Your Personalized Nutrition Platform
                    </p>
                    <p style="color: #D1D5DB; font-size: 12px; margin: 0;">
                      &copy; 2026 Naiosh Fit. All rights reserved.
                    </p>
                    <div style="margin-top: 16px;">
                      <a href="https://naioshfit.com" style="color: #991B1B; text-decoration: none; font-size: 13px; margin: 0 8px;">Website</a>
                      <span style="color: #D1D5DB;">•</span>
                      <a href="https://naioshfit.com/support" style="color: #991B1B; text-decoration: none; font-size: 13px; margin: 0 8px;">Support</a>
                      <span style="color: #D1D5DB;">•</span>
                      <a href="https://naioshfit.com/privacy" style="color: #991B1B; text-decoration: none; font-size: 13px; margin: 0 8px;">Privacy</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Security notice below card -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="color: #9CA3AF; font-size: 12px; line-height: 1.6; margin: 0; text-align: center; max-width: 450px;">
                🔒 This is an automated security email from Naiosh Fit. Never share your password or reset links with anyone.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return sendEmail({
    to: email,
    subject,
    text,
    html,
  }, context);
}
