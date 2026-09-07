import { Citizen, HealthRecord, VhvProfile } from '../types';

export const INITIAL_VHV_PROFILE: VhvProfile = {
  name: '',
  phone: '',
  birthDate: '',
  vhvId: '',
  villageName: '',
  moo: '',
  subdistrict: '',
  district: '',
  province: '',
  healthCenterName: '',
  hospitalReportEmail: '',
  email: '',
  fontSize: 'md',
};

export const INITIAL_CITIZENS: Citizen[] = [];

export const INITIAL_HEALTH_RECORDS: HealthRecord[] = [];
