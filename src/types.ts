export type HealthRight = 
  | 'บัตรทอง (UC/สปสช.)'
  | 'ประกันสังคม'
  | 'ข้าราชการ/รัฐวิสาหกิจ'
  | 'ข้าราชการ/เบิกจ่ายตรง'
  | 'ชำระเงินเอง'
  | 'สิทธิคนพิการ'
  | 'อื่นๆ';

export type PatientStatusType =
  | 'ผู้ป่วยทั่วไปที่ช่วยเหลือตนเองได้'
  | 'ผู้ป่วยที่มีภาวะพึ่งพิง/ช่วยเหลือตนเองได้น้อย'
  | 'ผู้ป่วยที่ไม่สามารถช่วยเหลือตนเองและต้องนอนอยู่บนเตียงเป็นส่วนใหญ่'
  | 'ผู้ป่วยที่มีความพิการ'
  | 'ผู้ป่วยที่ยังมีอาการเจ็บป่วย'
  | 'อื่นๆ';

export interface Citizen {
  id: string;
  prefix: 'นาย' | 'นาง' | 'นางสาว' | 'ด.ช.' | 'ด.หญิง' | 'อื่นๆ';
  firstName: string;
  lastName: string;
  idCard: string; // 13 digits
  gender: 'ชาย' | 'หญิง' | 'อื่นๆ';
  age: number;
  birthDate?: string; // YYYY-MM-DD
  phone: string;
  houseNo: string; // e.g. "12/1", "45"
  moo: string; // e.g. "หมู่ 3"
  villageName: string; // e.g. "บ้านหนองผักชี"
  healthRight: HealthRight;
  chronicDiseases: string[]; // e.g. ['ความดันโลหิตสูง']
  allergies?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  createdAt: string;
  notes?: string;
  avatarColor?: string;
  userId?: string;

  // Patient Status Assessment & Medical Equipment
  patientStatus?: string;
  recommendedTerm?: string;
  medicalEquipment?: string[];
  medicalEquipmentOther?: string;
}

export interface HealthRecord {
  id: string;
  citizenId: string;
  userId?: string;
  citizenName: string;
  citizenAge: number;
  gender: string;
  houseNo: string;
  moo: string;
  date: string; // YYYY-MM-DD
  time?: string;
  
  // Vital Signs
  systolic: number; // mmHg (ค่าบน)
  diastolic: number; // mmHg (ค่าล่าง)
  pulse?: number; // bpm (ชีพจร / ค่ากลางเครื่องวัด)
  weight?: number; // kg
  height?: number; // cm
  bmi?: number;
  waist?: number; // cm or inches
  waistUnit?: 'cm' | 'inch';
  bloodSugar?: number; // mg/dL (ค่าน้ำตาลในเลือด DTX)
  bloodSugarFasting?: boolean; // true = งดอาหาร (FBS), false = ไม่งดอาหาร (RBS)
  temperature?: number; // องศาเซลเซียส
  
  notes?: string;
  examinerName: string;
  createdAt: string;
}

export interface VhvProfile {
  name: string;
  phone: string;
  birthDate: string; // 8 digits e.g. 08052549
  vhvId?: string;
  villageName?: string;
  moo?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  healthCenterName?: string; // รพ.สต. ที่สังกัด
  hospitalReportEmail?: string;
  email?: string;
  fontSize?: 'sm' | 'md' | 'lg';
}

export interface AuthUser {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  provider: 'supabase' | 'guest';
  vhvCode?: string;
  isLoggedIn: boolean;
}

export interface HouseholdSummary {
  houseNo: string;
  moo: string;
  villageName: string;
  memberCount: number;
  members: Citizen[];
  latestCheckupDate?: string;
}

export interface SharedReport {
  id: string;
  senderId: string;
  senderName: string;
  senderPhone: string;
  senderVillage?: string;
  senderHealthCenter?: string;
  receiverId?: string;
  receiverName?: string;
  receiverPhone: string;
  title: string;
  periodLabel: string;
  recordsCount: number;
  citizensCount: number;
  fileName?: string;
  excelBase64?: string; // Stored base64 of the .xlsx file
  recordsData: HealthRecord[];
  citizensData: Citizen[];
  citizenData?: Citizen;
  healthRecords?: HealthRecord[];
  note?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'unread' | 'read' | 'downloaded' | 'imported' | 'cancelled';
  acceptedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ActiveTab = 
  | 'dashboard'
  | 'citizens'
  | 'households'
  | 'checkup'
  | 'analytics'
  | 'inbox'
  | 'settings';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface PatientAccessStatus {
  hasAccess: boolean;
  id?: string;
  citizenId: string;
  status?: 'active' | 'expired' | 'revoked';
  expiresAt?: string;
  createdAt?: string;
  revokedAt?: string;
  isExpired?: boolean;
  isLocked?: boolean;
}

export interface GeneratedPatientAccess {
  id: string;
  citizenId: string;
  status: 'active';
  expiresAt: string;
  createdAt: string;
  rawToken: string;
  pin: string;
  accessUrl: string;
}
