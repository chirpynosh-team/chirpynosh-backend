import nodemailer from 'nodemailer';
import { env } from '../config/env';

/**
 * Email Service
 * Handles sending emails using Nodemailer
 */

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '465', 10),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send OTP verification email
 */
export const sendOtpEmail = async (
  email: string,
  otp: string,
  name?: string
): Promise<void> => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"ChirpyNosh" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify Your Email - ChirpyNosh',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🍽️ ChirpyNosh</h1>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #333; margin-top: 0;">Welcome${name ? `, ${name}` : ''}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Thank you for signing up. Please use the following OTP to verify your email address:
            </p>
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              This OTP will expire in <strong>10 minutes</strong>.
            </p>
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
              If you didn't request this verification, please ignore this email.
            </p>
          </div>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} ChirpyNosh. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send password reset OTP email
 */
export const sendPasswordResetEmail = async (
  email: string,
  otp: string,
  name?: string
): Promise<void> => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"ChirpyNosh" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Password Reset - ChirpyNosh',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #333; margin-top: 0;">Hello${name ? `, ${name}` : ''}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password. Use the following OTP to proceed:
            </p>
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #f5576c;">${otp}</span>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              This OTP will expire in <strong>10 minutes</strong>.
            </p>
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
              If you didn't request a password reset, please ignore this email.
            </p>
          </div>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} ChirpyNosh. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};
