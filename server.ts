import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { setupPatientAccessRoutes } from './src/server/patientAccess';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // API Route: Direct Email Delivery with attached Excel (.xlsx) file
  app.post('/api/send-email', async (req, res) => {
    try {
      // 1. Authenticate Request via Supabase Session Token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบก่อนส่งรายงานทางอีเมล'
        });
      }

      const token = authHeader.substring(7).trim();
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'ไม่ได้รับอนุญาต: Token ไม่ถูกต้อง'
        });
      }

      const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({
          success: false,
          error: 'ไม่ได้รับอนุญาต: เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
        });
      }

      // 2. Validate Request Body
      const {
        recipientEmail,
        recipientName = 'เจ้าหน้าที่ รพ.สต. / ผู้รับรายงาน',
        subject = 'รายงานข้อมูลดิบผลการตรวจสุขภาพภาคสนาม อสม.',
        records = [],
        vhvProfile = {},
        fileName = 'ค่าวัดสุขภาพ_อสม_ผลตรวจดิบ',
        customNote = ''
      } = req.body;

      if (!recipientEmail || typeof recipientEmail !== 'string' || !EMAIL_REGEX.test(recipientEmail.trim())) {
        return res.status(400).json({ 
          success: false, 
          error: 'กรุณาระบุที่อยู่อีเมลผู้รับที่ถูกต้องตามรูปแบบ (เช่น example@hospital.go.th)' 
        });
      }

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'ไม่พบรายการข้อมูลผลการตรวจสุขภาพสำหรับส่งออก'
        });
      }

      if (records.length > 5000) {
        return res.status(400).json({
          success: false,
          error: 'จำนวนรายการเกินขีดจำกัดสูงสุด (5,000 รายการต่อครั้ง)'
        });
      }

      const cleanRecipientEmail = recipientEmail.trim();
      const cleanSubject = (typeof subject === 'string' && subject.trim()) ? subject.trim().substring(0, 200) : 'รายงานข้อมูลตรวจสุขภาพ อสม.';
      const cleanCustomNote = (typeof customNote === 'string' && customNote.trim()) ? customNote.trim().substring(0, 1000) : '';

      // 3. Build Raw Excel Data Matrix (Truthful fields without fabricated data)
      const rawRows = records.map((rec: any, idx: number) => ({
        'ลำดับ': idx + 1,
        'วันที่ตรวจ': rec.date || '',
        'เวลา': rec.time || '',
        'เลขบัตรประชาชน': rec.citizenIdCard || rec.idCard || '-',
        'คำนำหน้า': rec.citizenPrefix || '',
        'ชื่อ': rec.citizenFirstName || (rec.citizenName ? rec.citizenName.split(' ')[0] : ''),
        'นามสกุล': rec.citizenLastName || (rec.citizenName ? rec.citizenName.split(' ')[1] || '' : ''),
        'เพศ': rec.gender || '',
        'อายุ (ปี)': rec.citizenAge ?? '',
        'บ้านเลขที่': rec.houseNo || '',
        'หมู่ที่': rec.moo || '',
        'ค่าบน (SYS mmHg)': (rec.systolic !== undefined && rec.systolic !== null && rec.systolic !== '') ? rec.systolic : '',
        'ค่าล่าง (DIA mmHg)': (rec.diastolic !== undefined && rec.diastolic !== null && rec.diastolic !== '') ? rec.diastolic : '',
        'ชีพจร (PULSE bpm)': (rec.pulse !== undefined && rec.pulse !== null && rec.pulse !== '') ? rec.pulse : '',
        'รอบเอว': rec.waist ? `${rec.waist} ${rec.waistUnit === 'inch' ? 'นิ้ว' : 'ซม.'}` : '',
        'ระดับน้ำตาลในเลือด (FBS mg/dL)': (rec.bloodSugar !== undefined && rec.bloodSugar !== null && rec.bloodSugar !== '') ? rec.bloodSugar : '',
        'การงดอาหาร': rec.bloodSugarFasting === true ? 'งดอาหาร' : (rec.bloodSugarFasting === false ? 'ไม่งดอาหาร' : ''),
        'อุณหภูมิร่างกาย (°C)': (rec.temperature !== undefined && rec.temperature !== null && rec.temperature !== '') ? rec.temperature : '',
        'น้ำหนัก (กก.)': (rec.weight !== undefined && rec.weight !== null && rec.weight !== '') ? rec.weight : '',
        'ส่วนสูง (ซม.)': (rec.height !== undefined && rec.height !== null && rec.height !== '') ? rec.height : '',
        'ดัชนีมวลกาย (BMI)': (rec.bmi !== undefined && rec.bmi !== null && rec.bmi !== '') ? rec.bmi : '',
        'ข้อสังเกตเพิ่มเติม': rec.notes || '',
        'ผู้บันทึกตรวจ (อสม.)': rec.examinerName || vhvProfile.name || ''
      }));

      // 4. Create in-memory Excel Workbook
      const worksheet = XLSX.utils.json_to_sheet(rawRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'RawHealthData');

      // Set column widths
      worksheet['!cols'] = [
        { wch: 6 },  // ลำดับ
        { wch: 12 }, // วันที่ตรวจ
        { wch: 8 },  // เวลา
        { wch: 16 }, // เลขบัตร
        { wch: 10 }, // คำนำหน้า
        { wch: 14 }, // ชื่อ
        { wch: 16 }, // นามสกุล
        { wch: 8 },  // เพศ
        { wch: 10 }, // อายุ
        { wch: 12 }, // บ้านเลขที่
        { wch: 10 }, // หมู่
        { wch: 16 }, // ค่าบน SYS
        { wch: 16 }, // ค่าล่าง DIA
        { wch: 16 }, // ชีพจร PULSE
        { wch: 12 }, // รอบเอว
        { wch: 20 }, // น้ำตาลในเลือด
        { wch: 14 }, // การงดอาหาร
        { wch: 18 }, // อุณหภูมิ
        { wch: 12 }, // น้ำหนัก
        { wch: 12 }, // ส่วนสูง
        { wch: 16 }, // BMI
        { wch: 25 }, // ข้อสังเกต
        { wch: 22 }  // ผู้บันทึก
      ];

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const baseName = (typeof fileName === 'string' && fileName.trim()) ? fileName.trim() : 'ค่าวัดสุขภาพ_อสม';
      const safeFileName = `${baseName.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g, '_')}.xlsx`;

      const emailHtml = `
        <div style="font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #FDFCF8; border: 1px solid #DED8CF; border-radius: 16px; padding: 24px; color: #2C2C24; line-height: 1.6;">
          <div style="border-bottom: 2px solid #5D7052; padding-bottom: 12px; margin-bottom: 18px;">
            <h2 style="margin: 0 0 6px 0; color: #2C2C24; font-size: 18px; font-weight: bold;">
              ${cleanSubject}
            </h2>
            <p style="margin: 0; font-size: 13px; color: #5D7052; font-weight: 600;">
              เรียน: ${recipientName || 'เจ้าหน้าที่ รพ.สต. / ผู้รับรายงาน'}
            </p>
          </div>

          <div style="background-color: #FEFEFA; border: 1px solid #DED8CF; border-radius: 12px; padding: 16px; margin-bottom: 16px; font-size: 13px;">
            <strong style="color: #2C2C24; font-size: 14px; display: block; margin-bottom: 8px;">📋 ข้อมูล อสม. ผู้ส่งงาน:</strong>
            <ul style="margin: 0; padding-left: 18px; color: #4A4A40;">
              <li><strong>ชื่อ-นามสกุล:</strong> ${vhvProfile.name || 'อสม. ประจำชุมชน'}</li>
              <li><strong>รหัสประจำตัว อสม.:</strong> ${vhvProfile.vhvId || '-'}</li>
              <li><strong>สังกัด:</strong> รพ.สต. ${vhvProfile.healthCenterName || '-'}</li>
              <li><strong>พื้นที่รับผิดชอบ:</strong> ${vhvProfile.villageName || ''} ${vhvProfile.moo || ''} ต.${vhvProfile.subdistrict || ''} อ.${vhvProfile.district || ''} จ.${vhvProfile.province || ''}</li>
              <li><strong>เบอร์โทรศัพท์ติดต่อ:</strong> ${vhvProfile.phone || '-'}</li>
            </ul>
          </div>

          <div style="background-color: #F0EBE5; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; font-size: 13px; color: #2C2C24;">
            <strong style="display: block; margin-bottom: 4px;">สรุปการส่งมอบงาน:</strong>
            <p style="margin: 2px 0;">• <strong>จำนวนรายการที่ตรวจ:</strong> ${records.length} รายการ</p>
            <p style="margin: 2px 0;">• <strong>วันที่ส่งข้อมูล:</strong> ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            ${cleanCustomNote ? `<p style="margin: 6px 0 2px 0; color: #4A4A40;">• <strong>ข้อความ/หมายเหตุเพิ่มเติม:</strong> ${cleanCustomNote}</p>` : ''}
          </div>

          <div style="background-color: #FFFFFF; border: 1px dashed #5D7052; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px; font-size: 13px;">
            <div style="font-weight: bold; color: #5D7052; margin-bottom: 4px;">
              📎 แนบไฟล์รายงาน Excel (.xlsx)
            </div>
            <div style="color: #4A4A40;">
              ชื่อไฟล์: <strong>${safeFileName}</strong> (มีรายละเอียดค่าวัดตรวจสุขภาพดิบทั้งหมดครบทุกคอลัมน์)
            </div>
          </div>

          <div style="font-size: 12px; color: #78786C; border-top: 1px solid #E6DCCD; padding-top: 12px;">
            ขอแสดงความนับถือ,<br/>
            <strong>${vhvProfile.name || 'อสม.'}</strong><br/>
            อาสาสมัครสาธารณสุขประจำหมู่บ้าน (อสม.)
          </div>
        </div>
      `;

      // 5. Send Email via Transporter
      let previewUrl: string | false | null = null;

      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Production configured SMTP
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || `"${vhvProfile.name || 'อสม.'}" <no-reply@vhv-health.org>`,
            to: cleanRecipientEmail,
            subject: cleanSubject,
            html: emailHtml,
            attachments: [
              {
                filename: safeFileName,
                content: excelBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              }
            ]
          });
        } catch (smtpErr: any) {
          console.error('[send-email] SMTP delivery failed:', smtpErr?.message || smtpErr);
          return res.status(502).json({
            success: false,
            error: 'ไม่สามารถส่งอีเมลผ่านระบบ SMTP ได้ กรุณาตรวจสอบการตั้งค่าเซิร์ฟเวอร์อีเมลหรือลองใหม่อีกครั้ง'
          });
        }
      } else {
        // Use Ethereal test account for preview environment
        try {
          const testAccount = await nodemailer.createTestAccount();
          const transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });

          const infoResult = await transporter.sendMail({
            from: `"อสม. ${vhvProfile.name || 'สมาร์ทเฮลท์'}" <report@vhv-smarthealth.org>`,
            to: cleanRecipientEmail,
            subject: cleanSubject,
            html: emailHtml,
            attachments: [
              {
                filename: safeFileName,
                content: excelBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              }
            ]
          });
          previewUrl = nodemailer.getTestMessageUrl(infoResult);
        } catch (testMailErr: any) {
          console.error('[send-email] Test transporter delivery failed:', testMailErr?.message || testMailErr);
          return res.status(502).json({
            success: false,
            error: 'ไม่สามารถส่งอีเมลไปยังบริการอีเมลทดสอบได้ กรุณาลองใหม่อีกครั้ง'
          });
        }
      }

      return res.json({
        success: true,
        message: `ส่งไฟล์ Excel (.xlsx) และข้อมูลผลการตรวจไปยัง ${cleanRecipientEmail} เรียบร้อยแล้ว!`,
        recipient: cleanRecipientEmail,
        fileName: safeFileName,
        recordsCount: records.length,
        timestamp: new Date().toISOString(),
        previewUrl: previewUrl || null
      });

    } catch (error: any) {
      console.error('[send-email] Unexpected error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'เกิดข้อผิดพลาดภายในระบบในการส่งอีเมล'
      });
    }
  });

  // Mount Patient Self-Inspection Access Routes (Phase 1)
  setupPatientAccessRoutes(app, supabaseServer, supabaseUrl, supabaseAnonKey);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
