import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { setupPatientAccessRoutes } from './src/server/patientAccess';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ctllgomqzeweeyrvxboc.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_P91Ii_-0k1YPlbsGqpFamA_Y8NBqhpr';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseServer = createClient(supabaseUrl, supabaseAnonKey);

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // API Route: Direct Email Delivery with attached Excel (.xlsx) file
  app.post('/api/send-email', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ success:false, error:'ไม่ได้รับอนุญาต: กรุณาเข้าสู่ระบบก่อนส่งรายงานทางอีเมล' });
      const token = authHeader.substring(7).trim();
      if (!token) return res.status(401).json({ success:false, error:'ไม่ได้รับอนุญาต: Token ไม่ถูกต้อง' });
      const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ success:false, error:'ไม่ได้รับอนุญาต: เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
      const { recipientEmail, recipientName = 'เจ้าหน้าที่ รพ.สต. / ผู้รับรายงาน', subject = 'รายงานข้อมูลดิบผลการตรวจสุขภาพภาคสนาม อสม.', records = [], vhvProfile = {}, fileName = 'ค่าวัดสุขภาพ_อสม_ผลตรวจดิบ', customNote = '' } = req.body;
      if (!recipientEmail || typeof recipientEmail !== 'string' || !EMAIL_REGEX.test(recipientEmail.trim())) return res.status(400).json({ success:false, error:'กรุณาระบุที่อยู่อีเมลผู้รับที่ถูกต้องตามรูปแบบ' });
      if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ success:false, error:'ไม่พบรายการข้อมูลผลการตรวจสุขภาพสำหรับส่งออก' });
      if (records.length > 5000) return res.status(400).json({ success:false, error:'จำนวนรายการเกินขีดจำกัดสูงสุด (5,000 รายการต่อครั้ง)' });
      const cleanRecipientEmail = recipientEmail.trim();
      const cleanSubject = (typeof subject === 'string' && subject.trim()) ? subject.trim().substring(0,200) : 'รายงานข้อมูลตรวจสุขภาพ อสม.';
      const cleanCustomNote = (typeof customNote === 'string' && customNote.trim()) ? customNote.trim().substring(0,1000) : '';
      const rawRows = records.map((rec:any,idx:number)=>({ 'ลำดับ':idx+1,'วันที่ตรวจ':rec.date||'','เวลา':rec.time||'','เลขบัตรประชาชน':rec.citizenIdCard||rec.idCard||'-','คำนำหน้า':rec.citizenPrefix||'','ชื่อ':rec.citizenFirstName||(rec.citizenName?rec.citizenName.split(' ')[0]:''),'นามสกุล':rec.citizenLastName||(rec.citizenName?rec.citizenName.split(' ')[1]||'':''),'เพศ':rec.gender||'','อายุ (ปี)':rec.citizenAge??'','บ้านเลขที่':rec.houseNo||'','หมู่ที่':rec.moo||'','ค่าบน (SYS mmHg)':rec.systolic??'','ค่าล่าง (DIA mmHg)':rec.diastolic??'','ชีพจร (PULSE bpm)':rec.pulse??'','รอบเอว':rec.waist?`${rec.waist} ${rec.waistUnit==='inch'?'นิ้ว':'ซม.'}`:'','ระดับน้ำตาลในเลือด (FBS mg/dL)':rec.bloodSugar??'','การงดอาหาร':rec.bloodSugarFasting===true?'งดอาหาร':rec.bloodSugarFasting===false?'ไม่งดอาหาร':'','อุณหภูมิร่างกาย (°C)':rec.temperature??'','น้ำหนัก (กก.)':rec.weight??'','ส่วนสูง (ซม.)':rec.height??'','ดัชนีมวลกาย (BMI)':rec.bmi??'','ข้อสังเกตเพิ่มเติม':rec.notes||'','ผู้บันทึกตรวจ (อสม.)':rec.examinerName||vhvProfile.name||'' }));
      const worksheet=XLSX.utils.json_to_sheet(rawRows); const workbook=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook,worksheet,'RawHealthData');
      const excelBuffer=XLSX.write(workbook,{type:'buffer',bookType:'xlsx'}); const baseName=(typeof fileName==='string'&&fileName.trim())?fileName.trim():'ค่าวัดสุขภาพ_อสม'; const safeFileName=`${baseName.replace(/[^a-zA-Z0-9_\u0E00-\u0E7F-]/g,'_')}.xlsx`;
      const emailHtml=`<div style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;padding:24px"><h2>${cleanSubject}</h2><p>เรียน: ${recipientName}</p><p>จำนวนรายการที่ตรวจ: <strong>${records.length}</strong></p>${cleanCustomNote?`<p>${cleanCustomNote}</p>`:''}<p>แนบไฟล์รายงาน Excel (.xlsx): <strong>${safeFileName}</strong></p><p>ขอแสดงความนับถือ,<br/><strong>${vhvProfile.name||'อสม.'}</strong></p></div>`;
      let previewUrl:string|false|null=null;
      if (process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS) {
        const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT)||587,secure:(Number(process.env.SMTP_PORT)||587)===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
        const info=await transporter.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:cleanRecipientEmail,subject:cleanSubject,html:emailHtml,attachments:[{filename:safeFileName,content:excelBuffer,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}]});
        previewUrl=nodemailer.getTestMessageUrl(info);
      } else {
        const testAccount=await nodemailer.createTestAccount(); const transporter=nodemailer.createTransport({host:'smtp.ethereal.email',port:587,secure:false,auth:{user:testAccount.user,pass:testAccount.pass}}); const info=await transporter.sendMail({from:`"อสม. ${vhvProfile.name||'สมาร์ทเฮลท์'}" <report@vhv-smarthealth.org>`,to:cleanRecipientEmail,subject:cleanSubject,html:emailHtml,attachments:[{filename:safeFileName,content:excelBuffer,contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}]}); previewUrl=nodemailer.getTestMessageUrl(info);
      }
      return res.json({success:true,message:`ส่งไฟล์ Excel (.xlsx) และข้อมูลผลการตรวจไปยัง ${cleanRecipientEmail} เรียบร้อยแล้ว!`,recipient:cleanRecipientEmail,fileName:safeFileName,recordsCount:records.length,timestamp:new Date().toISOString(),previewUrl:previewUrl||null});
    } catch(error:any){ console.error('[send-email]',error); return res.status(500).json({success:false,error:error?.message||'เกิดข้อผิดพลาดภายในระบบในการส่งอีเมล'}); }
  });

  // Patient Access API. The service-role key is never sent to the browser.
  setupPatientAccessRoutes(app, supabaseServer, supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey || undefined);

  if (process.env.NODE_ENV !== 'production') {
    const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});
    app.use(vite.middlewares);
  } else {
    const distPath=path.join(process.cwd(),'dist'); app.use(express.static(distPath)); app.get('*',(req,res)=>res.sendFile(path.join(distPath,'index.html')));
  }
  app.listen(PORT,'0.0.0.0',()=>console.log(`Server running on http://localhost:${PORT}`));
}
startServer();
