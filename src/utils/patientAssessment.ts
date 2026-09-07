import { PatientStatusType } from '../types';

export interface PatientStatusOption {
  id: string;
  label: PatientStatusType;
  recommendedTerm: string;
  alternativeTerms?: string[];
  badgeColor: string;
  description: string;
  iconName?: string;
}

export const PATIENT_STATUS_OPTIONS: PatientStatusOption[] = [
  {
    id: 'self-reliant',
    label: 'ผู้ป่วยทั่วไปที่ช่วยเหลือตนเองได้',
    recommendedTerm: 'ผู้ป่วยทั่วไป',
    alternativeTerms: ['ผู้ป่วยช่วยเหลือตนเองได้'],
    badgeColor: 'bg-[#5D7052]/15 text-[#5D7052] border-[#5D7052]/30',
    description: 'สามารถดำเนินชีวิตประจำวันและช่วยเหลือตนเองได้ดี',
  },
  {
    id: 'homebound',
    label: 'ผู้ป่วยที่มีภาวะพึ่งพิง/ช่วยเหลือตนเองได้น้อย',
    recommendedTerm: 'ผู้ป่วยติดบ้าน',
    alternativeTerms: ['ผู้ป่วยช่วยเหลือตนเองได้น้อย'],
    badgeColor: 'bg-[#C18C5D]/20 text-[#C18C5D] border-[#C18C5D]/40',
    description: 'เคลื่อนไหวได้จำกัด ต้องการการดูแลช่วยเหลือในชีวิตประจำวัน',
  },
  {
    id: 'bedridden',
    label: 'ผู้ป่วยที่ไม่สามารถช่วยเหลือตนเองและต้องนอนอยู่บนเตียงเป็นส่วนใหญ่',
    recommendedTerm: 'ผู้ป่วยติดเตียง',
    alternativeTerms: ['ผู้ป่วยนอนติดเตียง'],
    badgeColor: 'bg-[#A85448]/20 text-[#A85448] border-[#A85448]/40',
    description: 'ไม่สามารถช่วยเหลือตนเองได้ ต้องนอนอยู่บนเตียงเป็นส่วนใหญ่',
  },
  {
    id: 'disabled',
    label: 'ผู้ป่วยที่มีความพิการ',
    recommendedTerm: 'ผู้ป่วย/บุคคลพิการ',
    alternativeTerms: ['บุคคลพิการ'],
    badgeColor: 'bg-[#7E6551]/20 text-[#7E6551] border-[#7E6551]/40',
    description: 'มีความบกพร่องทางการเคลื่อนไหว ร่างกาย สติปัญญา หรือการสื่อสาร',
  },
  {
    id: 'symptomatic',
    label: 'ผู้ป่วยที่ยังมีอาการเจ็บป่วย',
    recommendedTerm: 'ผู้ป่วยมีอาการ / อยู่ระหว่างการรักษา',
    alternativeTerms: ['อยู่ระหว่างการรักษา'],
    badgeColor: 'bg-[#8B5E3C]/20 text-[#8B5E3C] border-[#8B5E3C]/40',
    description: 'มีอาการของโรคหรือมีภาวะเฉียบพลันที่ต้องติดตามการรักษาต่อเนื่อง',
  },
  {
    id: 'other',
    label: 'อื่นๆ',
    recommendedTerm: 'อื่นๆ',
    badgeColor: 'bg-[#78786C]/20 text-[#78786C] border-[#78786C]/40',
    description: 'ระบุสถานะหรือคำอธิบายเพิ่มเติมเฉพาะบุคคล',
  },
];

export const MEDICAL_EQUIPMENT_OPTIONS = [
  'สายสวนปัสสาวะ (Foley catheter)',
  'สายให้อาหารทางจมูก (NG tube)',
  'สายให้อาหารทางหน้าท้อง (PEG tube)',
  'ท่อเจาะคอ (Tracheostomy tube)',
  'ออกซิเจน (O₂)',
  'เครื่องช่วยหายใจ',
  'แผลกดทับ/อุปกรณ์ดูแลแผล',
  'อื่นๆ',
] as const;

export type MedicalEquipmentType = typeof MEDICAL_EQUIPMENT_OPTIONS[number];

/**
 * Returns the recommended term for a given patient status string.
 */
export function getRecommendedTermForStatus(status?: string): string {
  if (!status) return '';
  const match = PATIENT_STATUS_OPTIONS.find(opt => opt.label === status);
  if (match) return match.recommendedTerm;
  return status;
}

/**
 * Returns complete badge styling and display label for a patient status and recommended term.
 */
export function getPatientStatusBadge(status?: string, term?: string) {
  if (!status) {
    return {
      hasStatus: false,
      label: 'ยังไม่ได้ระบุสถานะผู้ป่วย',
      term: '',
      badgeColor: 'bg-[#F0EBE5] text-[#78786C] border-[#DED8CF]',
    };
  }

  const match = PATIENT_STATUS_OPTIONS.find(opt => opt.label === status);
  if (match) {
    return {
      hasStatus: true,
      label: match.label,
      term: term || match.recommendedTerm,
      badgeColor: match.badgeColor,
    };
  }

  return {
    hasStatus: true,
    label: status,
    term: term || status,
    badgeColor: 'bg-[#78786C]/20 text-[#78786C] border-[#78786C]/40',
  };
}
