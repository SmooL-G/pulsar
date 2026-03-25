import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendResetEmail(email: string, code: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn('SMTP not configured, reset code:', code);
    return false;
  }

  try {
    await t.sendMail({
      from: `"Pulsar" <${env.SMTP_FROM}>`,
      to: email,
      subject: 'Password Reset — Pulsar',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 30px; background: #1a1a2e; color: #e0e0e0; border-radius: 16px;">
          <h2 style="color: #8b5cf6; margin: 0 0 20px;">Pulsar</h2>
          <p>Your password reset code:</p>
          <div style="background: #16213e; padding: 16px; border-radius: 12px; text-align: center; margin: 16px 0;">
            <span style="font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #a78bfa;">${code}</span>
          </div>
          <p style="font-size: 13px; color: #888;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Failed to send reset email:', err);
    return false;
  }
}
