/**
 * SMTP Configuration Test Script
 * Run this to verify your SMTP settings before deploying
 * 
 * Usage: tsx scripts/test-smtp.ts
 */

import 'dotenv/config';
import nodemailer from 'nodemailer';

async function testSMTPConnection() {
  console.log('\n=== SMTP Configuration Test ===\n');

  // Check environment variables
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  console.log('Configuration:');
  console.log('  SMTP_HOST:', smtpHost || '❌ NOT SET');
  console.log('  SMTP_PORT:', smtpPort);
  console.log('  SMTP_USER:', smtpUser ? smtpUser.substring(0, 5) + '***' : '❌ NOT SET');
  console.log('  SMTP_PASS:', smtpPass ? '***' + smtpPass.substring(smtpPass.length - 3) : '❌ NOT SET');
  console.log('  SMTP_FROM:', smtpFrom || '❌ NOT SET');
  console.log('');

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('❌ Error: Missing required SMTP configuration');
    console.error('   Please set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables');
    console.error('');
    console.error('Common SMTP Settings:');
    console.error('');
    console.error('📧 Gmail:');
    console.error('   SMTP_HOST=smtp.gmail.com');
    console.error('   SMTP_PORT=587 (or 465)');
    console.error('   SMTP_USER=your-email@gmail.com');
    console.error('   SMTP_PASS=your-app-password (not regular password!)');
    console.error('   Note: Enable 2FA and create an App Password at https://myaccount.google.com/apppasswords');
    console.error('');
    console.error('📧 Outlook/Office365:');
    console.error('   SMTP_HOST=smtp.office365.com');
    console.error('   SMTP_PORT=587');
    console.error('   SMTP_USER=your-email@outlook.com');
    console.error('   SMTP_PASS=your-password');
    console.error('');
    console.error('📧 SendGrid:');
    console.error('   SMTP_HOST=smtp.sendgrid.net');
    console.error('   SMTP_PORT=587 (or 465)');
    console.error('   SMTP_USER=apikey');
    console.error('   SMTP_PASS=your-sendgrid-api-key');
    console.error('');
    console.error('📧 AWS SES:');
    console.error('   SMTP_HOST=email-smtp.us-east-1.amazonaws.com (region-specific)');
    console.error('   SMTP_PORT=587 (or 465)');
    console.error('   SMTP_USER=your-smtp-username');
    console.error('   SMTP_PASS=your-smtp-password');
    console.error('');
    process.exit(1);
  }

  try {
    console.log('🔄 Creating SMTP transport...');

    const transportConfig: any = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 60000,
      socketTimeout: 60000,
      greetingTimeout: 30000,
      logger: true, // Enable detailed logging for testing
      debug: true,  // Enable debug output
    };

    if (smtpPort !== 465) {
      transportConfig.requireTLS = true;
      transportConfig.tls = {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    console.log('🔄 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');

    // Prompt for test email
    console.log('Would you like to send a test email? (Set TEST_EMAIL environment variable)');
    const testEmail = process.env.TEST_EMAIL;
    
    if (testEmail) {
      console.log(`🔄 Sending test email to ${testEmail}...`);
      
      const info = await transporter.sendMail({
        from: smtpFrom,
        to: testEmail,
        subject: 'SMTP Test - Naiosh Fit',
        text: 'This is a test email from your Naiosh Fit SMTP configuration.',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>✅ SMTP Test Successful!</h2>
            <p>Your SMTP configuration is working correctly.</p>
            <p><strong>Configuration:</strong></p>
            <ul>
              <li>Host: ${smtpHost}</li>
              <li>Port: ${smtpPort}</li>
              <li>User: ${smtpUser}</li>
            </ul>
            <p style="color: #666; font-size: 12px;">
              This is an automated test email from Naiosh Fit password reset system.
            </p>
          </div>
        `,
      });

      console.log('✅ Test email sent successfully!');
      console.log('   Message ID:', info.messageId);
      console.log('   Response:', info.response);
      console.log('');
    } else {
      console.log('ℹ️  To send a test email, run:');
      console.log('   TEST_EMAIL=your-email@example.com tsx scripts/test-smtp.ts');
      console.log('');
    }

    console.log('✅ All SMTP tests passed!');
    console.log('');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ SMTP Test Failed!\n');
    console.error('Error:', error.message);
    if (error.code) console.error('Code:', error.code);
    if (error.command) console.error('Command:', error.command);
    if (error.response) console.error('Response:', error.response);
    if (error.responseCode) console.error('Response Code:', error.responseCode);
    console.error('');
    
    console.error('💡 Troubleshooting Tips:');
    console.error('');
    
    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('   Connection Timeout - Possible causes:');
      console.error('   • SMTP host or port is incorrect');
      console.error('   • Server firewall blocking outbound SMTP connections');
      console.error('   • SMTP service is down');
      console.error('   • Network/DNS issues');
      console.error('');
    } else if (error.code === 'EAUTH') {
      console.error('   Authentication Failed - Possible causes:');
      console.error('   • Username or password is incorrect');
      console.error('   • For Gmail: Use App Password, not regular password');
      console.error('   • Account may require "Less secure app access" enabled');
      console.error('   • 2FA may be required');
      console.error('');
    } else if (error.code === 'EENVELOPE') {
      console.error('   Invalid Email Address - Possible causes:');
      console.error('   • SMTP_FROM or recipient email format is invalid');
      console.error('   • Email domain not verified (for some SMTP services)');
      console.error('');
    } else if (error.code === 'ESOCKET') {
      console.error('   Socket Error - Possible causes:');
      console.error('   • TLS/SSL configuration mismatch');
      console.error('   • Try different port (587 vs 465)');
      console.error('   • Check if requireTLS is needed');
      console.error('');
    }

    console.error('   For more help, check:');
    console.error('   • Your SMTP provider\'s documentation');
    console.error('   • Server firewall settings (allow outbound SMTP)');
    console.error('   • Email provider security settings');
    console.error('');
    
    process.exit(1);
  }
}

testSMTPConnection();
