import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  KeyRound, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  Printer, 
  RefreshCw, 
  XCircle, 
  Copy, 
  Check, 
  ExternalLink,
  Lock,
  WifiOff
} from 'lucide-react';
import { Citizen, VhvProfile, PatientAccessStatus, GeneratedPatientAccess } from '../types';
import { getPatientAccessStatus, generatePatientAccess, revokePatientAccess, isNetworkOnline } from '../lib/patientAccessApi';

interface PatientAccessSectionProps {
  citizen: Citizen;
  vhvProfile: VhvProfile;
}

export const PatientAccessSection: React.FC<PatientAccessSectionProps> = ({ citizen, vhvProfile }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [statusInfo, setStatusInfo] = useState<PatientAccessStatus | null>(null);
  const [generatedAccess, setGeneratedAccess] = useState<GeneratedPatientAccess | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<boolean>(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<boolean>(false);

  // Load current access status on mount or when citizen changes
  const loadStatus = useCallback(async () => {
    if (!citizen?.id) return;
    setLoading(true);
    setErrorMessage(null);

    const result = await getPatientAccessStatus(citizen.id);
    if (result.success) {
      if (result.access) {
        setStatusInfo(result.access);
      } else {
        setStatusInfo({
          hasAccess: false,
          citizenId: citizen.id,
          status: 'revoked'
        });
      }
    } else {
      // If offline or status check error, preserve existing or show gentle notice
      setErrorMessage(result.error || null);
    }
    setLoading(false);
  }, [citizen?.id]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Generate QR code data URL whenever a new generatedAccess is present
  useEffect(() => {
    if (!generatedAccess?.accessUrl) {
      setQrDataUrl(null);
      return;
    }

    let isMounted = true;
    QRCode.toDataURL(generatedAccess.accessUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#2C2C24',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR Code render error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [generatedAccess?.accessUrl]);

  // Handle generation of new access
  const handleGenerateAccess = async () => {
    if (!isNetworkOnline()) {
      setErrorMessage('ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อสร้างสิทธิ์เข้าดูผลตรวจ');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    setShowRegenerateConfirm(false);

    try {
      const result = await generatePatientAccess(citizen.id, selectedDays);
      if (result.success && result.access) {
        setGeneratedAccess(result.access);
        setStatusInfo({
          hasAccess: true,
          id: result.access.id,
          citizenId: citizen.id,
          status: 'active',
          expiresAt: result.access.expiresAt,
          createdAt: result.access.createdAt
        });
      } else {
        setErrorMessage(result.error || 'ไม่สามารถสร้างสิทธิ์ได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle revoking active access
  const handleRevokeAccess = async () => {
    if (!isNetworkOnline()) {
      setErrorMessage('ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อยกเลิกสิทธิ์');
      return;
    }

    setActionLoading(true);
    setErrorMessage(null);
    setShowRevokeConfirm(false);

    try {
      const result = await revokePatientAccess({
        citizenId: citizen.id,
        accessId: statusInfo?.id || generatedAccess?.id
      });

      if (result.success) {
        setGeneratedAccess(null);
        setQrDataUrl(null);
        setStatusInfo({
          hasAccess: false,
          citizenId: citizen.id,
          status: 'revoked',
          revokedAt: new Date().toISOString()
        });
      } else {
        setErrorMessage(result.error || 'ไม่สามารถยกเลิกสิทธิ์ได้');
      }
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setActionLoading(false);
    }
  };

  // Copy PIN to clipboard
  const handleCopyPin = () => {
    if (!generatedAccess?.pin) return;
    navigator.clipboard.writeText(generatedAccess.pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Copy Link to clipboard
  const handleCopyUrl = () => {
    if (!generatedAccess?.accessUrl) return;
    navigator.clipboard.writeText(generatedAccess.accessUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Format Thai datetime
  const formatThaiDateTime = (isoDateString?: string) => {
    if (!isoDateString) return '-';
    try {
      const d = new Date(isoDateString);
      return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.';
    } catch (e) {
      return isoDateString;
    }
  };

  // Print Slip for Patient
  const handlePrintSlip = () => {
    if (!qrDataUrl || !generatedAccess) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const patientFullName = `${citizen.prefix} ${citizen.firstName} ${citizen.lastName}`;
    const vhvName = vhvProfile.name || 'อสม. ประจำชุมชน';
    const expiresText = formatThaiDateTime(generatedAccess.expiresAt);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>สิทธิ์เข้าดูผลตรวจสุขภาพ - ${patientFullName}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 4mm;
            }
            body {
              font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, sans-serif;
              font-size: 13px;
              color: #111;
              line-height: 1.4;
              margin: 0;
              padding: 6px;
              text-align: center;
              background: #fff;
            }
            .title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 2px;
            }
            .sub {
              font-size: 11px;
              color: #555;
              margin-bottom: 10px;
            }
            .box {
              border: 1px dashed #666;
              border-radius: 8px;
              padding: 10px;
              margin-bottom: 12px;
              background-color: #fafafa;
            }
            .name {
              font-size: 15px;
              font-weight: bold;
              color: #2C2C24;
              margin-bottom: 4px;
            }
            .qr-img {
              width: 170px;
              height: 170px;
              margin: 6px auto;
              display: block;
            }
            .pin-container {
              background: #eee;
              border-radius: 6px;
              padding: 8px;
              margin: 8px 0;
            }
            .pin-label {
              font-size: 11px;
              color: #555;
            }
            .pin-code {
              font-size: 26px;
              font-weight: bold;
              letter-spacing: 4px;
              color: #2C2C24;
              font-family: monospace;
            }
            .instructions {
              text-align: left;
              font-size: 11px;
              color: #444;
              margin-top: 10px;
              line-height: 1.5;
            }
            .instructions ol {
              padding-left: 18px;
              margin: 4px 0;
            }
            .footer {
              border-top: 1px solid #ddd;
              padding-top: 6px;
              margin-top: 10px;
              font-size: 10px;
              color: #777;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="title">สิทธิ์เข้าดูผลตรวจสุขภาพ</div>
          <div class="sub">${vhvProfile.healthCenterName ? 'รพ.สต. ' + vhvProfile.healthCenterName : 'ระบบ อสม. สมาร์ทเฮลท์'}</div>

          <div class="box">
            <div class="name">${patientFullName}</div>
            <div style="font-size: 11px; color: #666;">บ้านเลขที่ ${citizen.houseNo} ${citizen.moo}</div>

            <img src="${qrDataUrl}" class="qr-img" alt="QR Code สิทธิ์เข้าดูผลตรวจ" />

            <div class="pin-container">
              <div class="pin-label">รหัส PIN สำหรับเข้าใช้งาน</div>
              <div class="pin-code">${generatedAccess.pin}</div>
            </div>

            <div style="font-size: 11px; color: #78786C; margin-top: 4px;">
              ใช้งานได้ถึง: <strong>${expiresText}</strong>
            </div>
          </div>

          <div class="instructions">
            <strong>วิธีเข้าดูผลตรวจสุขภาพ:</strong>
            <ol>
              <li>ใช้กล้องมือถือ หรือแอป LINE สแกน QR Code ด้านบน</li>
              <li>กรอกรหัส PIN 6 หลักที่ระบุในเอกสารนี้</li>
              <li>เข้าดูผลตรวจค่าวัดสุขภาพล่าสุดได้ทันที</li>
            </ol>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">
              * กรุณาเก็บรักษารหัส PIN ไว้อย่างปลอดภัย เพื่อความเป็นส่วนตัวของข้อมูล
            </div>
          </div>

          <div class="footer">
            ออกเอกสารโดย: ${vhvName}<br/>
            พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const hasActiveAccess = Boolean(statusInfo?.hasAccess && statusInfo.status === 'active');

  return (
    <div className="bg-[#FEFEFA] border border-[#DED8CF] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DED8CF]/70 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#5D7052]/15 text-[#5D7052] flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm sm:text-base text-[#2C2C24] flex items-center gap-2">
              <span>สิทธิ์เข้าดูผลตรวจสุขภาพ</span>
              {hasActiveAccess && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#5D7052]/15 text-[#5D7052] border border-[#5D7052]/30">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>ใช้งานได้</span>
                </span>
              )}
              {statusInfo?.status === 'expired' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#A85448]/15 text-[#A85448] border border-[#A85448]/30">
                  <span>หมดอายุแล้ว</span>
                </span>
              )}
              {statusInfo?.status === 'revoked' && !hasActiveAccess && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#78786C]/15 text-[#78786C] border border-[#78786C]/30">
                  <span>ยกเลิกสิทธิ์แล้ว</span>
                </span>
              )}
            </h4>
            <p className="text-xs text-[#78786C] mt-0.5">
              สร้าง QR Code และรหัส PIN 6 หลัก เพื่อให้ผู้ป่วยเปิดดูผลตรวจได้ด้วยตนเองโดยไม่ต้องสมัครสมาชิก
            </p>
          </div>
        </div>

        {/* Reload Status Button */}
        <button
          onClick={loadStatus}
          disabled={loading || actionLoading}
          className="self-end sm:self-auto p-1.5 text-[#78786C] hover:text-[#2C2C24] hover:bg-[#F0EBE5] rounded-xl transition-colors text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
          title="รีเฟรชสถานะสิทธิ์"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline text-[11px]">ตรวจสถานะ</span>
        </button>
      </div>

      {/* Error Message Box */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#A85448]/10 border border-[#A85448]/25 text-[#A85448] text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{errorMessage}</span>
          </div>
          <button 
            onClick={() => setErrorMessage(null)} 
            className="text-[#A85448] hover:underline font-bold text-xs"
          >
            ปิด
          </button>
        </div>
      )}

      {/* Main Body */}
      {loading ? (
        <div className="py-6 flex flex-col items-center justify-center gap-2 text-[#78786C] text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-[#5D7052]" />
          <span>กำลังตรวจสอบสถานะสิทธิ์...</span>
        </div>
      ) : (
        <div>
          {/* CASE A: Active access with freshly generated QR Code & PIN ready to present */}
          {generatedAccess && qrDataUrl ? (
            <div className="space-y-4">
              <div className="bg-[#F0EBE5]/60 border border-[#DED8CF] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center gap-6">
                {/* QR Code Container */}
                <div className="bg-white p-3 rounded-2xl border border-[#DED8CF] shadow-xs shrink-0 text-center">
                  <img
                    src={qrDataUrl}
                    alt="QR Code สำหรับผู้ป่วย"
                    className="w-44 h-44 sm:w-48 sm:h-48 mx-auto rounded-lg object-contain"
                  />
                  <span className="text-[11px] text-[#78786C] block mt-1 font-medium">
                    สแกนเพื่อเข้าดูผลตรวจ
                  </span>
                </div>

                {/* PIN and Access Details */}
                <div className="flex-1 space-y-3.5 text-center md:text-left w-full">
                  <div>
                    <span className="text-xs text-[#78786C] block">ผู้ป่วย:</span>
                    <h5 className="font-bold text-base text-[#2C2C24]">
                      {citizen.prefix} {citizen.firstName} {citizen.lastName}
                    </h5>
                  </div>

                  {/* PIN Display Box */}
                  <div className="bg-white border border-[#DED8CF] rounded-2xl p-3.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#78786C] flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-[#5D7052]" />
                        <span>รหัส PIN 6 หลัก</span>
                      </span>
                      <button
                        onClick={handleCopyPin}
                        className="text-[11px] text-[#5D7052] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedPin ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>คัดลอกแล้ว</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>คัดลอก PIN</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="font-mono text-3xl font-extrabold tracking-widest text-[#2C2C24] py-1 select-all">
                      {generatedAccess.pin.slice(0, 3)} {generatedAccess.pin.slice(3)}
                    </div>

                    <p className="text-[11px] text-[#78786C] mt-1">
                      * ผู้ป่วยต้องใช้รหัส PIN 6 หลักนี้ร่วมกับ QR Code เพื่อยืนยันตัวตน
                    </p>
                  </div>

                  {/* Expiration & Status Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-[#DED8CF]/70">
                      <span className="text-[11px] text-[#78786C] block">สิทธิ์ใช้งาน:</span>
                      <span className="font-bold text-[#5D7052] flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>ใช้งานได้</span>
                      </span>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-xl border border-[#DED8CF]/70">
                      <span className="text-[11px] text-[#78786C] block">หมดอายุ:</span>
                      <span className="font-bold text-[#2C2C24] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-[#C18C5D]" />
                        <span>{formatThaiDateTime(generatedAccess.expiresAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrintSlip}
                    className="flex items-center gap-1.5 bg-[#5D7052] hover:bg-[#48573F] text-white px-4 py-2.5 rounded-full text-xs font-semibold shadow-soft transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>พิมพ์ / บันทึก QR</span>
                  </button>

                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 bg-white hover:bg-[#F0EBE5] text-[#4A4A40] border border-[#DED8CF] px-3.5 py-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#5D7052]" />
                        <span>คัดลอกลิงก์แล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#78786C]" />
                        <span>คัดลอกลิงก์</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRegenerateConfirm(true)}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-full text-xs font-semibold text-[#4A4A40] bg-white border border-[#DED8CF] hover:bg-[#F0EBE5] transition-colors cursor-pointer"
                  >
                    สร้างสิทธิ์ใหม่
                  </button>

                  <button
                    onClick={() => setShowRevokeConfirm(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-semibold text-[#A85448] bg-white border border-[#A85448]/30 hover:bg-[#A85448]/10 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>ยกเลิกสิทธิ์</span>
                  </button>
                </div>
              </div>
            </div>
          ) : hasActiveAccess ? (
            /* CASE B: Active access previously granted (not freshly generated in this browser memory) */
            <div className="bg-[#FEFEFA] border border-[#5D7052]/30 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5D7052] animate-pulse"></span>
                    <span className="font-bold text-sm text-[#2C2C24]">
                      ผู้ป่วยมีสิทธิ์เข้าดูผลตรวจสุขภาพอยู่ในปัจจุบัน
                    </span>
                  </div>
                  <p className="text-xs text-[#78786C] mt-1">
                    สิทธิ์ถูกสร้างเมื่อ {formatThaiDateTime(statusInfo?.createdAt)} และจะหมดอายุในวันที่{' '}
                    <strong className="text-[#2C2C24]">{formatThaiDateTime(statusInfo?.expiresAt)}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRegenerateConfirm(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#5D7052] hover:bg-[#48573F] text-white rounded-full text-xs font-semibold shadow-soft transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>สร้างสิทธิ์ใหม่</span>
                  </button>

                  <button
                    onClick={() => setShowRevokeConfirm(true)}
                    disabled={actionLoading}
                    className="flex items-center gap-1 px-3.5 py-2 text-[#A85448] bg-white border border-[#A85448]/30 hover:bg-[#A85448]/10 rounded-full text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>ยกเลิกสิทธิ์</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#F0EBE5]/50 border border-[#DED8CF]/80 rounded-xl text-xs text-[#78786C] flex items-start gap-2">
                <Lock className="w-4 h-4 text-[#5D7052] shrink-0 mt-0.5" />
                <span>
                  เพื่อความปลอดภัยและความเป็นส่วนตัวของข้อมูลผู้ป่วย รหัส PIN และ QR Code จะแสดงเพียงครั้งเดียวเมื่อสร้างสิทธิ์ หากผู้ป่วยทำแผ่นรหัสหายหรือลืมรหัส PIN ท่านสามารถกด <strong>"สร้างสิทธิ์ใหม่"</strong> ได้ทันที
                </span>
              </div>
            </div>
          ) : (
            /* CASE C: No active access (never created, expired, or revoked) */
            <div className="bg-[#F0EBE5]/40 border border-[#DED8CF] rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-[#78786C] block">สถานะ:</span>
                  <span className="font-bold text-sm text-[#4A4A40] mt-0.5 block">
                    {statusInfo?.status === 'expired' 
                      ? 'สิทธิ์เดิมหมดอายุแล้ว' 
                      : statusInfo?.status === 'revoked' 
                      ? 'สิทธิ์เดิมถูกยกเลิกแล้ว' 
                      : 'ยังไม่มีสิทธิ์เข้าดูข้อมูล'}
                  </span>
                  <p className="text-xs text-[#78786C] mt-1">
                    เมื่อกดสร้างสิทธิ์ ระบบจะออก QR Code และรหัส PIN 6 หลักที่ปลอดภัยสำหรับผู้ป่วยรายนี้
                  </p>
                </div>

                {/* Expiration Period Selection */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-xs text-[#78786C] font-medium mr-1">อายุสิทธิ์:</span>
                  {[
                    { days: 1, label: '24 ชม.' },
                    { days: 7, label: '7 วัน' },
                    { days: 30, label: '30 วัน' }
                  ].map((item) => (
                    <button
                      key={item.days}
                      type="button"
                      onClick={() => setSelectedDays(item.days)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        selectedDays === item.days
                          ? 'bg-[#5D7052] text-white shadow-xs'
                          : 'bg-white text-[#4A4A40] border border-[#DED8CF] hover:bg-[#F0EBE5]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#DED8CF]/60">
                <div className="text-[11px] text-[#78786C] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#5D7052]" />
                  <span>ระบบความปลอดภัย: รหัสแบบสุ่มเข้ารหัส ไร้ข้อมูลส่วนบุคคลใน QR</span>
                </div>

                <button
                  onClick={handleGenerateAccess}
                  disabled={actionLoading}
                  className="flex items-center justify-center gap-2 bg-[#5D7052] hover:bg-[#48573F] text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-soft transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังสร้างสิทธิ์...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      <span>สร้างสิทธิ์ให้ผู้ป่วยดูผลตรวจ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal: Regenerate Access */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#DED8CF] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#C18C5D]/20 text-[#C18C5D] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-[#2C2C24]">
                  ยืนยันการสร้างสิทธิ์ใหม่?
                </h4>
                <p className="text-xs text-[#78786C] mt-1 leading-relaxed">
                  สิทธิ์เดิมของผู้ป่วยจะถูกยกเลิกทันที และระบบจะสร้าง QR Code พร้อมรหัส PIN 6 หลักชุดใหม่
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#78786C]">กำหนดอายุสิทธิ์ใหม่:</span>
              {[
                { days: 1, label: '24 ชม.' },
                { days: 7, label: '7 วัน' },
                { days: 30, label: '30 วัน' }
              ].map((item) => (
                <button
                  key={item.days}
                  type="button"
                  onClick={() => setSelectedDays(item.days)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                    selectedDays === item.days
                      ? 'bg-[#5D7052] text-white'
                      : 'bg-white text-[#4A4A40] border border-[#DED8CF]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DED8CF]">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-[#4A4A40] hover:bg-[#F0EBE5] transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleGenerateAccess}
                disabled={actionLoading}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#5D7052] hover:bg-[#48573F] shadow-soft transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'กำลังสร้าง...' : 'ยืนยันสร้างสิทธิ์ใหม่'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Revoke Access */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl border border-[#DED8CF] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#A85448]/20 text-[#A85448] flex items-center justify-center shrink-0">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-[#2C2C24]">
                  ต้องการยกเลิกสิทธิ์เข้าดูผลตรวจ?
                </h4>
                <p className="text-xs text-[#78786C] mt-1 leading-relaxed">
                  เมื่อยกเลิกแล้ว QR Code และรหัส PIN เดิมจะใช้งานไม่ได้ทันที ข้อมูลผลตรวจสุขภาพและประวัติผู้ป่วยจะไม่ได้รับผลกระทบใด ๆ
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DED8CF]">
              <button
                onClick={() => setShowRevokeConfirm(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-[#4A4A40] hover:bg-[#F0EBE5] transition-colors cursor-pointer"
              >
                ปิด
              </button>
              <button
                onClick={handleRevokeAccess}
                disabled={actionLoading}
                className="px-4 py-2 rounded-full text-xs font-bold text-white bg-[#A85448] hover:bg-[#8F3E33] shadow-soft transition-all cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกสิทธิ์'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
