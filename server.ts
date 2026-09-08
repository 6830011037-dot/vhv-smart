import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { setupPatientAccessRoutesV2 } from './src/server/patientAccessV2';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseServer = createClient(supabaseUrl, supabasePublishableKey);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.use(express.json({ limit: '15mb' }));

  app.post('/api/send-email', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบก่อนส่งรายงานทางอีเมล' });
      const token = authHeader.substring(7).trim();
      if (!token) return res.status(401).json({ success: false, error: 'ไม่ได้รับอนุญาต: Token ไม่ถูกต้อง' });
      const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ success: false, error: 'ไม่ได้รับอนุญาต: เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });

      const { recipientEmail, recipientName = 'เจ้าหน้าที่ รพ.สต. / ผู้รับรายงาน', subject = 'รายงานข้อมูลดิบผลการตรวจสุขภาพภาคสนาม อสม.', records = [], vhvProfile = {}, fileName = 'ค่าวัดสุขภาพ_อสม_ผลตรวจดิบ', customNote = '' } = req.body;
      if (!recipientEmail || typeof recipientEmail !== 'string' || !EMAIL_REGEX.test(recipientEmail.trim())) return res.status(400).json({ success: false, error: 'กรุณาระบุที่อยู่อีเมลผู้รับที่ถูกต้องตามรูปแบบ (เช่น example@hospital.go.th)' });
      if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ success: false, error: 'ไม่พบรายการข้อมูลผลการตรวจสุขภาพสำหรับส่งออก' });
      if (records.length > 5000) return res.status(400).json({ success: false, error: 'จำนวนรายการเกินขีดจำกัดสูงสุด (5,000 รายการต่อครั้ง)' });

      const cleanRecipientEmail = recipientEmail.trim();
      const cleanSubject = (typeof subject === 'string' && subject.trim()) ? subject.trim().substring(0, 200) : 'รายงานข้อมูลตรวจสุขภาพ อสม.';
      const safeFileName = (typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'ค่าวัดสุขภาพ_อสม_ผลตรวจดิบ').replace(/[\\/:*?"<>|]/g, '_').substring(0, 120) + '.xlsx';
      const worksheet = XLSX.utils.json_to_sheet(records);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ผลการตรวจ');
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const emailHtml = `<div style="font-family:Arial,sans-serif"><h2>${cleanSubject}</h2><p>เรียน ${String(recipientName).replace(/[<>]/g, '')}</p><p>แนบไฟล์ข้อมูลผลการตรวจสุขภาพจำนวน ${records.length.toLocaleString()} รายการ</p><p>${String(customNote || '').replace(/[<>]/g, '')}</p></div>`;
      let previewUrl: string | null = null;
      const smtpHost = process.env.SMTP_HOST?.trim();
      if (smtpHost) {
        const transporter = nodemailer.createTransport({ host: smtpHost, port: Number(process.env.SMTP_PORT) || 587, secure: Number(process.env.SMTP_PORT) === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined });
        await transporter.sendMail({ from: process.env.SMTP_FROM || 'no-reply@vhv-health.org', to: cleanRecipientEmail, subject: cleanSubject, html: emailHtml, attachments: [{ filename: safeFileName, content: excelBuffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }] });
      } else {
        try {
          const testTransporter = nodemailer.createTransport({ jsonTransport: true });
          const infoResult = await testTransporter.sendMail({ from: 'no-reply@vhv-health.org', to: cleanRecipientEmail, subject: cleanSubject, html: emailHtml, attachments: [{ filename: safeFileName, content: excelBuffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }] });
          previewUrl = nodemailer.getTestMessageUrl(infoResult) || null;
        } catch (testMailErr: any) { console.error('[send-email] Test transporter delivery failed:', testMailErr?.message || testMailErr); return res.status(502).json({ success: false, error: 'ไม่สามารถส่งอีเมลไปยังบริการอีเมลทดสอบได้ กรุณาลองใหม่อีกครั้ง' }); }
      }
      return res.json({ success: true, message: `ส่งไฟล์ Excel (.xlsx) และข้อมูลผลการตรวจไปยัง ${cleanRecipientEmail} เรียบร้อยแล้ว!`, recipient: cleanRecipientEmail, fileName: safeFileName, recordsCount: records.length, timestamp: new Date().toISOString(), previewUrl });
    } catch (error: any) { console.error('[send-email] Unexpected error:', error); return res.status(500).json({ success: false, error: error.message || 'เกิดข้อผิดพลาดภายในระบบในการส่งอีเมล' }); }
  });

  setupPatientAccessRoutesV2(app, supabaseServer, supabaseUrl, supabasePublishableKey, supabaseSecretKey || undefined);
  if (process.env.NODE_ENV === 'production' && !supabaseSecretKey) throw new Error('SUPABASE_SECRET_KEY is required in production for patient access');
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const patientAccessDistPath = path.join(process.cwd(), 'patient-access', 'dist');
    app.use('/patient-view', express.static(patientAccessDistPath));
    app.get('/patient-view/*', (req, res) => res.sendFile(path.join(patientAccessDistPath, 'index.html')));
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}
startServer();
