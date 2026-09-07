import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  HeartHandshake,
  User, 
  Phone,
  Calendar,
  Building2,
  MapPin,
  Save,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './ToastNotification';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { vhvProfile, updateProfile, user } = useApp();
  const { showToast } = useToast();
  const [form, setForm] = useState({ ...vhvProfile });

  useEffect(() => {
    setForm({ ...vhvProfile });
  }, [vhvProfile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile(form);
    showToast('บันทึกข้อมูลเรียบร้อย', 'ข้อมูลประจำตัว อสม. อัปเดตเรียบร้อยแล้ว', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2C2C24]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FDFCF8] border border-[#DED8CF] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-float relative overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-full transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5 shrink-0">
          <div className="w-12 h-12 bg-[#5D7052]/10 text-[#5D7052] rounded-2xl mx-auto flex items-center justify-center mb-2.5 shadow-inner">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <h3 className="font-heading font-bold text-xl text-[#2C2C24]">
            ข้อมูลโปรไฟล์ อสม.
          </h3>
          <p className="text-xs text-[#78786C] mt-0.5">
            เชื่อมต่อกับบัญชี: <span className="font-semibold text-[#2C2C24]">{user?.phone || user?.name}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 overflow-y-auto pr-1 flex-1">
          <div>
            <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
              ชื่อ-นามสกุล อสม.
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#78786C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="เช่น นายสมศักดิ์ สุขใจ"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#DED8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0999999999"
                className="w-full px-3 py-2 text-xs bg-white border border-[#DED8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                รหัส อสม.
              </label>
              <input
                type="text"
                value={form.vhvId || ''}
                onChange={(e) => setForm({ ...form, vhvId: e.target.value })}
                placeholder="VHV-01"
                className="w-full px-3 py-2 text-xs bg-white border border-[#DED8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                ชื่อหมู่บ้าน / ชุมชน
              </label>
              <input
                type="text"
                value={form.villageName || ''}
                onChange={(e) => setForm({ ...form, villageName: e.target.value })}
                placeholder="เช่น บ้านหนองหอย"
                className="w-full px-3 py-2 text-xs bg-white border border-[#DED8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
                หมู่ที่
              </label>
              <input
                type="text"
                value={form.moo || ''}
                onChange={(e) => setForm({ ...form, moo: e.target.value })}
                placeholder="เช่น หมู่ 2"
                className="w-full px-3 py-2 text-xs bg-white border border-[#DED8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4A4A40] mb-1">
              หน่วยบริการสาธารณสุข / รพ.สต. สังกัด
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-[#78786C] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={form.healthCenterName || ''}
                onChange={(e) => setForm({ ...form, healthCenterName: e.target.value })}
                placeholder="เช่น รพ.สต. บ้านหนองหอย"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#DED8CF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5D7052]/30"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#5D7052] hover:bg-[#48573F] text-white text-xs font-bold rounded-xl shadow-soft hover:shadow-moss-glow transition-all cursor-pointer mt-3"
          >
            <Save className="w-4 h-4" />
            <span>บันทึกการแก้ไข</span>
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-[#DED8CF]/60 flex items-center justify-center gap-2 text-[11px] text-[#78786C] shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-[#5D7052]" />
          <span>ซิงค์ข้อมูลกับ Supabase อัตโนมัติ</span>
        </div>

      </div>
    </div>
  );
};
