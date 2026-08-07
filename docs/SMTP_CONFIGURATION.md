# SMTP Configuration Guide

This guide helps you configure email functionality for the password reset system.

## Required Environment Variables

Add these to your environment configuration (Railway, .env, etc.):

```bash
SMTP_HOST=smtp.example.com      # Your SMTP server hostname
SMTP_PORT=587                    # Port (typically 587 or 465)
SMTP_USER=your-email@domain.com  # SMTP username (usually your email)
SMTP_PASS=your-password          # SMTP password or API key
SMTP_FROM=noreply@domain.com     # Optional: sender email (defaults to SMTP_USER)
FRONTEND_URL=https://yourdomain.com  # Your frontend URL for reset links
```

## Common SMTP Providers

### 📧 Gmail

**Settings:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587  # or 465 for SSL
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Setup Steps:**
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Use the generated 16-character password as `SMTP_PASS`

**Note:** Regular Gmail passwords won't work - you must use an App Password!

---

### 📧 Outlook / Office 365

**Settings:**
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

**Setup Steps:**
1. Use your regular Outlook/Office365 password
2. Ensure "SMTP AUTH" is enabled for your account

---

### 📧 SendGrid

**Settings:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587  # or 465 for SSL
SMTP_USER=apikey  # Literally "apikey"
SMTP_PASS=your-sendgrid-api-key
```

**Setup Steps:**
1. Sign up at [SendGrid](https://sendgrid.com)
2. Create an API key with "Mail Send" permissions
3. Use "apikey" as the username (not your email)
4. Use your API key as the password

---

### 📧 AWS SES (Amazon Simple Email Service)

**Settings:**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Region-specific
SMTP_PORT=587  # or 465 for SSL
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

**Setup Steps:**
1. Create SMTP credentials in AWS SES console
2. Verify your sender email or domain
3. If in sandbox mode, verify recipient emails too
4. Use the region-specific SMTP endpoint

---

### 📧 Mailgun

**Settings:**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@yourdomain.mailgun.org
SMTP_PASS=your-smtp-password
```

**Setup Steps:**
1. Sign up at [Mailgun](https://mailgun.com)
2. Add and verify your domain
3. Get SMTP credentials from the domain settings

---

### 📧 Resend

**Settings:**
```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=587  # or 465 for SSL
SMTP_USER=resend
SMTP_PASS=your-api-key
```

**Setup Steps:**
1. Sign up at [Resend](https://resend.com)
2. Create an API key
3. Use "resend" as the username
4. Use your API key as the password

---

## Testing Your Configuration

Run the SMTP test script to verify your settings:

```bash
# Test connection only
npx tsx scripts/test-smtp.ts

# Test connection and send test email
TEST_EMAIL=your-email@example.com npx tsx scripts/test-smtp.ts
```

## Troubleshooting

### Error: Connection Timeout

**Possible causes:**
- Incorrect SMTP host or port
- Server firewall blocking outbound SMTP connections
- SMTP service is down
- Network/DNS issues

**Solutions:**
- Verify SMTP_HOST and SMTP_PORT are correct
- Check server firewall settings (Railway allows SMTP by default)
- Try alternative port (587 vs 465)
- Contact your hosting provider

### Error: Authentication Failed

**Possible causes:**
- Incorrect username or password
- Using regular password instead of app password (Gmail)
- Account security settings blocking access
- 2FA required but not configured

**Solutions:**
- Double-check SMTP_USER and SMTP_PASS
- For Gmail: Use App Password, not regular password
- Check email provider's security settings
- Enable "Less secure app access" if required (not recommended)

### Error: Invalid Email Address

**Possible causes:**
- SMTP_FROM format is invalid
- Email domain not verified with provider
- Sender email doesn't match authenticated user

**Solutions:**
- Ensure SMTP_FROM is a valid email format
- Verify your domain with the SMTP provider
- For some providers, SMTP_FROM must match SMTP_USER

### Email Goes to Spam

**Solutions:**
- Verify your domain with SMTP provider
- Set up SPF, DKIM, and DMARC records
- Use a verified sender email address
- Avoid spam trigger words in subject/content
- Use a reputable SMTP service (SendGrid, AWS SES, etc.)

## Port Configuration

- **Port 465**: SSL/TLS connection (secure from start)
- **Port 587**: STARTTLS connection (upgrades to secure)
- **Port 25**: Plain SMTP (not recommended, often blocked)

Most modern setups use port 587 with STARTTLS.

## Security Notes

1. **Never commit SMTP credentials** to version control
2. Use environment variables for all sensitive data
3. For Gmail, **always use App Passwords**, not regular passwords
4. Rotate SMTP passwords regularly
5. Use dedicated SMTP services (SendGrid, AWS SES) for production
6. Monitor email sending for suspicious activity

## Railway-Specific Notes

Railway allows outbound SMTP connections by default. To set environment variables:

1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Add each SMTP variable
5. Redeploy your service

## Need Help?

If you're still having issues:

1. Run the test script: `npx tsx scripts/test-smtp.ts`
2. Check the detailed error output
3. Review your SMTP provider's documentation
4. Check server logs for connection errors
5. Verify firewall settings with your hosting provider
