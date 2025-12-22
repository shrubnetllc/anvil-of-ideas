import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { storage } from './storage';
import 'dotenv/config';

// Initialize Mailgun client
const mailgun = new Mailgun(formData);

// Check if the required environment variables are set
if (!process.env.MAILGUN_API_KEY) {
  console.warn('Warning: MAILGUN_API_KEY environment variable is not set. Email functionality will not work.');
}

if (!process.env.MAILGUN_DOMAIN) {
  console.warn('Warning: MAILGUN_DOMAIN environment variable is not set. Email functionality will not work.');
}

// Create a client with API key
const client = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY || '',
});

const domain = process.env.MAILGUN_DOMAIN || '';

export interface EmailMessage {
  to: string | string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  'h:X-Mailgun-Variables'?: string;
}

class EmailService {
  private defaultFrom: string;
  private readonly defaultFromEmail = `Anvil of Ideas <no-reply@${domain}>`;
  private readonly settingKey = 'email_from_address';

  constructor() {
    this.defaultFrom = this.defaultFromEmail;
    // Initialize the from address from settings if available
    this.initializeFromAddress();
  }

  /**
   * Initialize the from address from app settings
   */
  private async initializeFromAddress(): Promise<void> {
    try {
      const fromAddress = await storage.getSetting(this.settingKey);
      if (fromAddress) {
        this.defaultFrom = fromAddress;
        console.log(`Email 'from' address loaded from settings: ${fromAddress}`);
      } else {
        // If setting doesn't exist, initialize it with the default value
        await storage.setSetting(this.settingKey, this.defaultFromEmail);
        console.log(`Email 'from' address initialized with default: ${this.defaultFromEmail}`);
      }
    } catch (error) {
      console.error('Failed to initialize email settings:', error);
    }
  }

  /**
   * Update the from address in settings
   */
  async updateFromAddress(fromAddress: string): Promise<boolean> {
    try {
      await storage.setSetting(this.settingKey, fromAddress);
      this.defaultFrom = fromAddress;
      console.log(`Email 'from' address updated to: ${fromAddress}`);
      return true;
    } catch (error) {
      console.error('Failed to update email from address:', error);
      return false;
    }
  }

  /**
   * Get the current from address
   */
  async getFromAddress(): Promise<string> {
    try {
      const fromAddress = await storage.getSetting(this.settingKey);
      return fromAddress || this.defaultFromEmail;
    } catch (error) {
      console.error('Failed to get email from address:', error);
      return this.defaultFromEmail;
    }
  }

  /**
   * Send an email via Mailgun
   */
  async sendEmail(message: EmailMessage): Promise<boolean> {
    try {
      if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
        console.error('Email sending failed: Mailgun credentials not configured');
        return false;
      }

      const messageData = {
        from: message.from || this.defaultFrom,
        to: Array.isArray(message.to) ? message.to.join(',') : message.to,
        subject: message.subject,
        text: message.text || '',
        html: message.html || '',
        template: message.template,
        'h:X-Mailgun-Variables': message['h:X-Mailgun-Variables'],
      };

      await client.messages.create(domain, messageData);
      console.log(`Email sent to ${messageData.to}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send a welcome email to a new user
   */
  async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    const message: EmailMessage = {
      to: email,
      subject: 'Welcome to Anvil of Ideas!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #FF8A00;">Welcome to Anvil of Ideas!</h1>
          <p>Hello ${username},</p>
          <p>Thank you for joining Anvil of Ideas, the platform that helps entrepreneurs forge, validate, 
             and develop their business ideas using the Lean Canvas methodology.</p>
          <p>With our platform, you can:</p>
          <ul>
            <li>Create and manage business ideas</li>
            <li>Generate complete Lean Canvas models with AI assistance</li>
            <li>Collaborate with team members</li>
            <li>Track progress on your entrepreneurial journey</li>
          </ul>
          <p>Ready to get started? Click the button below to forge your first idea!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://your-app-url.com'}" 
               style="background-color: #FF8A00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
               Forge Your First Idea
            </a>
          </div>
          <p>If you have any questions, feel free to reply to this email.</p>
          <p>Best regards,<br>The Anvil of Ideas Team</p>
        </div>
      `,
    };

    return this.sendEmail(message);
  }

  /**
   * Send a notification when a Lean Canvas is generated
   */
  async sendCanvasGeneratedEmail(email: string, username: string, ideaTitle: string): Promise<boolean> {
    const message: EmailMessage = {
      to: email,
      subject: 'Your Lean Canvas is Ready!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #FF8A00;">Your Lean Canvas is Ready!</h1>
          <p>Hello ${username},</p>
          <p>Great news! The Lean Canvas for your idea "${ideaTitle}" has been successfully generated.</p>
          <p>Your Lean Canvas model includes:</p>
          <ul>
            <li>Problem and customer segments analysis</li>
            <li>Unique value proposition</li>
            <li>Solution strategies</li>
            <li>Revenue streams and cost structure</li>
            <li>Key metrics and unfair advantages</li>
          </ul>
          <p>Click the button below to view your Lean Canvas and continue developing your idea:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'https://your-app-url.com'}" 
               style="background-color: #FF8A00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
               View Your Lean Canvas
            </a>
          </div>
          <p>Best regards,<br>The Anvil of Ideas Team</p>
        </div>
      `,
    };

    return this.sendEmail(message);
  }

  /**
   * Send an email verification link to a new user
   */
  async sendVerificationEmail(email: string, username: string, verificationUrl: string): Promise<boolean> {
    const message: EmailMessage = {
      to: email,
      subject: 'Please Verify Your Email - Anvil of Ideas',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #FF8A00;">Complete Your Registration</h1>
          <p>Hello ${username},</p>
          <p>Thank you for joining <strong>Anvil of Ideas</strong>! Please confirm your email to finish setting up your account.</p>
          
          <div style="background-color: #FFF7ED; border-left: 4px solid #FF8A00; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;">Confirming your email helps us:</p>
            <p style="margin: 5px 0 0 0;">• Ensure you receive important notifications</p>
            <p style="margin: 5px 0 0 0;">• Protect your account security</p>
            <p style="margin: 5px 0 0 0;">• Enable all platform features</p>
          </div>
          
          <p>Please click the button below to confirm your email:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
              style="background-color: #FF8A00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Confirm My Email
            </a>
          </div>
          
          <p>Link not working? Copy this URL into your browser:</p>
          <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px;">
            ${verificationUrl}
          </p>
          
          <p>This confirmation link expires in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #EEE; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">If you didn't create an account with us, you can ignore this email.</p>
          <p>Thanks,<br>The Anvil of Ideas Team</p>
        </div>
      `,
    };

    return this.sendEmail(message);
  }

  /**
   * Send a test email to verify configuration
   */
  async sendTestEmail(email: string): Promise<boolean> {
    const message: EmailMessage = {
      to: email,
      subject: 'Test Email from Anvil of Ideas',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #FF8A00;">Email Configuration Test</h1>
          <p>This is a test email from Anvil of Ideas.</p>
          <p>If you're receiving this, it means your email service is properly configured!</p>
          <div style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #FF8A00; margin: 20px 0;">
            <p style="margin: 0;">Configuration details:</p>
            <p style="margin: 5px 0 0 0;">- Service: Mailgun</p>
            <p style="margin: 5px 0 0 0;">- Domain: ${domain}</p>
            <p style="margin: 5px 0 0 0;">- Time: ${new Date().toISOString()}</p>
          </div>
          <p>Best regards,<br>The Anvil of Ideas Team</p>
        </div>
      `,
    };

    return this.sendEmail(message);
  }
}

export const emailService = new EmailService();
