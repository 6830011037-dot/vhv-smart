import * as XLSX from 'xlsx';
import { Citizen, HealthRecord, VhvProfile } from '../types';
import { formatThaiDate } from './healthCalculations';

export function exportHealthDataToExcel(
  records: HealthRecord[],
  citizens: Citizen[],
  vhvProfile: VhvProfile,
  fileNamePrefix: string = 'ค่าวัดสุขภาพภาคสนาม_อสม',
  filterDateLabel: string = ''
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: บันทึกค่าวัดตรวจสุขภาพ (เฉพาะค่าตัวเลขที่ตรวจได้จริง ไม่แปลผล)
  const screeningRows = records.map((rec, index) => {
    const cit = citizens.find(c => c.id === rec.citizenId);
    const idCard = cit?.idCard || '-';
    const chronic = cit?.chronicDiseases && cit.chronicDiseases.length > 0 ? cit.chronicDiseases.join(', ') : '-';

    return {
      'ลำดับ': index + 1,
      'วันที่ตรวจ': formatThaiDate(rec.date),
      'เวลาที่ตรวจ': rec.time || '-',
      'เลขบัตรประชาชน': idCard,
      'ชื่อ - นามสกุล': rec.citizenName,
      'เพศ': rec.gender,
      'อายุ (ปี)': rec.citizenAge,
      'บ้านเลขที่': rec.houseNo,
      'หมู่ที่': rec.moo,
      'ค่าบน (SYS)': rec.systolic ?? '-',
      'ค่ากลาง (DIA)': rec.diastolic ?? '-',
      'ค่าล่าง / ชีพจร (PUL)': rec.pulse ?? '-',
      'รอบเอว': rec.waist ?? '-',
      'หน่วยรอบเอว': rec.waist ? (rec.waistUnit === 'inch' ? 'นิ้ว' : 'ซม.') : '-',
      'ค่าน้ำตาลในเลือด (mg/dL)': rec.bloodSugar ?? '-',
      'สถานะการงดอาหาร': rec.bloodSugar ? (rec.bloodSugarFasting === false ? 'ไม่งดอาหาร' : 'งดอาหาร') : '-',
      'น้ำหนัก (กก.)': rec.weight ?? '-',
      'ส่วนสูง (ซม.)': rec.height ?? '-',
      'BMI': rec.bmi ?? '-',
      'โรคประจำตัว': chronic,
      'ผู้บันทึกตรวจ (อสม.)': rec.examinerName,
      'หมายเหตุ/ข้อสังเกต': rec.notes || '-'
    };
  });

  const wsScreenings = XLSX.utils.json_to_sheet(screeningRows);
  XLSX.utils.book_append_sheet(wb, wsScreenings, 'ค่าวัดสุขภาพรายบุคคล');

  // 2. Sheet: ทะเบียนประวัติประชาชน
  const citizenRows = citizens.map((cit, index) => {
    return {
      'ลำดับ': index + 1,
      'รหัสประจำตัว': cit.id,
      'คำนำหน้า': cit.prefix,
      'ชื่อ': cit.firstName,
      'นามสกุล': cit.lastName,
      'เลขบัตรประชาชน': cit.idCard,
      'เพศ': cit.gender,
      'อายุ (ปี)': cit.age,
      'วันเกิด': cit.birthDate || '-',
      'เบอร์โทรศัพท์': cit.phone,
      'บ้านเลขที่': cit.houseNo,
      'หมู่ที่': cit.moo,
      'หมู่บ้าน': cit.villageName,
      'สิทธิการรักษา': cit.healthRight,
      'โรคประจำตัว': cit.chronicDiseases.join(', ') || 'ไม่มี',
      'ประวัติแพ้ยา/อาหาร': cit.allergies || 'ไม่มี',
      'ผู้ติดต่อฉุกเฉิน': cit.emergencyContact || '-',
      'เบอร์ฉุกเฉิน': cit.emergencyPhone || '-',
      'หมายเหตุ': cit.notes || '-'
    };
  });

  const wsCitizens = XLSX.utils.json_to_sheet(citizenRows);
  XLSX.utils.book_append_sheet(wb, wsCitizens, 'ทะเบียนประชาชน');

  // Generate date stamp
  const now = new Date();
  const dateStamp = `${now.getFullYear() + 543}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const suffix = filterDateLabel ? `_${filterDateLabel.replace(/[\/\s:]/g, '_')}` : '';
  const fileName = `${fileNamePrefix}_${vhvProfile.villageName}_${dateStamp}${suffix}.xlsx`;

  // Trigger download
  XLSX.writeFile(wb, fileName);
  return fileName;
}

export function generateGmailRawDataUrl(
  records: HealthRecord[],
  citizens: Citizen[],
  vhvProfile: VhvProfile,
  datePeriodLabel: string = 'วันที่ระบุ',
  customNote: string = ''
): { mailtoUrl: string; webGmailUrl: string; emailSubject: string; emailBody: string; fileName: string } {
  const todayThai = formatThaiDate(new Date().toISOString().split('T')[0]);

  const emailSubject = `[ส่งงาน อสม.] รายงานค่าวัดตรวจสุขภาพ ${vhvProfile.villageName} ${vhvProfile.moo} (${datePeriodLabel})`;

  let emailBody = `เรียน: เจ้าหน้าที่ รพ.สต. / หัวหน้างาน\n\n`;
  emailBody += `ข้อมูล อสม. ผู้ส่งงาน:\n`;
  emailBody += `• ชื่อ-นามสกุล: ${vhvProfile.name}\n`;
  emailBody += `• รหัสประจำตัว อสม.: ${vhvProfile.vhvId || '-'}\n`;
  emailBody += `• สังกัด: รพ.สต. ${vhvProfile.healthCenterName || '-'}\n`;
  emailBody += `• พื้นที่รับผิดชอบ: ${vhvProfile.villageName} ${vhvProfile.moo} ต.${vhvProfile.subdistrict} อ.${vhvProfile.district} จ.${vhvProfile.province}\n`;
  emailBody += `• เบอร์โทรศัพท์: ${vhvProfile.phone || '-'}\n\n`;

  emailBody += `สรุปการส่งมอบงาน:\n`;
  emailBody += `• วันที่ส่ง: ${todayThai}\n`;
  emailBody += `• รอบการตรวจ: ${datePeriodLabel}\n`;
  emailBody += `• จำนวนผู้ได้รับการตรวจ: ${records.length} รายการ\n`;
  if (customNote && customNote.trim()) {
    emailBody += `• ข้อความ/หมายเหตุเพิ่มเติม: ${customNote.trim()}\n`;
  }
  emailBody += `\n`;

  emailBody += `📎 แนบไฟล์รายงาน Excel (.xlsx) ที่มีรายละเอียดข้อมูลค่าวัดตรวจสุขภาพดิบครบถ้วนมาพร้อมกับอีเมลนี้แล้วค่ะ/ครับ\n\n`;

  emailBody += `ขอแสดงความนับถือ,\n`;
  emailBody += `${vhvProfile.name}\n`;
  emailBody += `อาสาสมัครสาธารณสุขประจำหมู่บ้าน (อสม.)`;

  const now = new Date();
  const dateStamp = `${now.getFullYear() + 543}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const fileName = `ค่าวัดสุขภาพ_${vhvProfile.villageName}_${dateStamp}.xlsx`;

  const encodedSubject = encodeURIComponent(emailSubject);
  const encodedBody = encodeURIComponent(emailBody);

  const mailtoUrl = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
  const webGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodedSubject}&body=${encodedBody}`;

  return { mailtoUrl, webGmailUrl, emailSubject, emailBody, fileName };
}

export function createExcelWorkbookBase64(
  records: HealthRecord[],
  citizens: Citizen[],
  vhvProfile: VhvProfile,
  fileNamePrefix: string = 'ค่าวัดสุขภาพภาคสนาม_อสม',
  filterDateLabel: string = ''
): { fileName: string; base64: string } {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: บันทึกค่าวัดตรวจสุขภาพ
  const screeningRows = records.map((rec, index) => {
    const cit = citizens.find(c => c.id === rec.citizenId);
    const idCard = cit?.idCard || '-';
    const chronic = cit?.chronicDiseases && cit.chronicDiseases.length > 0 ? cit.chronicDiseases.join(', ') : '-';

    return {
      'ลำดับ': index + 1,
      'วันที่ตรวจ': formatThaiDate(rec.date),
      'เวลาที่ตรวจ': rec.time || '-',
      'เลขบัตรประชาชน': idCard,
      'ชื่อ - นามสกุล': rec.citizenName,
      'เพศ': rec.gender,
      'อายุ (ปี)': rec.citizenAge,
      'บ้านเลขที่': rec.houseNo,
      'หมู่ที่': rec.moo,
      'ค่าบน (SYS)': rec.systolic ?? '-',
      'ค่ากลาง (DIA)': rec.diastolic ?? '-',
      'ค่าล่าง / ชีพจร (PUL)': rec.pulse ?? '-',
      'รอบเอว': rec.waist ?? '-',
      'หน่วยรอบเอว': rec.waist ? (rec.waistUnit === 'inch' ? 'นิ้ว' : 'ซม.') : '-',
      'ค่าน้ำตาลในเลือด (mg/dL)': rec.bloodSugar ?? '-',
      'สถานะการงดอาหาร': rec.bloodSugar ? (rec.bloodSugarFasting === false ? 'ไม่งดอาหาร' : 'งดอาหาร') : '-',
      'น้ำหนัก (กก.)': rec.weight ?? '-',
      'ส่วนสูง (ซม.)': rec.height ?? '-',
      'BMI': rec.bmi ?? '-',
      'โรคประจำตัว': chronic,
      'ผู้บันทึกตรวจ (อสม.)': rec.examinerName,
      'หมายเหตุ/ข้อสังเกต': rec.notes || '-'
    };
  });

  const wsScreenings = XLSX.utils.json_to_sheet(screeningRows);
  XLSX.utils.book_append_sheet(wb, wsScreenings, 'ค่าวัดสุขภาพรายบุคคล');

  // 2. Sheet: ทะเบียนประวัติประชาชน
  const citizenRows = citizens.map((cit, index) => {
    return {
      'ลำดับ': index + 1,
      'รหัสประจำตัว': cit.id,
      'คำนำหน้า': cit.prefix,
      'ชื่อ': cit.firstName,
      'นามสกุล': cit.lastName,
      'เลขบัตรประชาชน': cit.idCard,
      'เพศ': cit.gender,
      'อายุ (ปี)': cit.age,
      'วันเกิด': cit.birthDate || '-',
      'เบอร์โทรศัพท์': cit.phone,
      'บ้านเลขที่': cit.houseNo,
      'หมู่ที่': cit.moo,
      'หมู่บ้าน': cit.villageName,
      'สิทธิการรักษา': cit.healthRight,
      'โรคประจำตัว': cit.chronicDiseases.join(', ') || 'ไม่มี',
      'ประวัติแพ้ยา/อาหาร': cit.allergies || 'ไม่มี',
      'ผู้ติดต่อฉุกเฉิน': cit.emergencyContact || '-',
      'เบอร์ฉุกเฉิน': cit.emergencyPhone || '-',
      'หมายเหตุ': cit.notes || '-'
    };
  });

  const wsCitizens = XLSX.utils.json_to_sheet(citizenRows);
  XLSX.utils.book_append_sheet(wb, wsCitizens, 'ทะเบียนประชาชน');

  const now = new Date();
  const dateStamp = `${now.getFullYear() + 543}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const suffix = filterDateLabel ? `_${filterDateLabel.replace(/[\/\s:]/g, '_')}` : '';
  const villageClean = (vhvProfile.villageName || 'ชุมชน').replace(/[\/\s:]/g, '_');
  const fileName = `${fileNamePrefix}_${villageClean}_${dateStamp}${suffix}.xlsx`;

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  return { fileName, base64 };
}

export function downloadExcelFromBase64(base64: string, fileName: string) {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Download error:', err);
  }
}

export function triggerPrintReport() {
  window.print();
}
