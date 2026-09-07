export function calculateAgeFromBirthDate(birthDateString: string): number {
  if (!birthDateString) return 0;
  try {
    const today = new Date();
    let birthYear: number;
    let birthMonth: number;
    let birthDay: number;

    const parts = birthDateString.trim().split(/[-/]/);
    if (parts.length === 3) {
      let y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return 0;
      if (y > 2400) y -= 543; // Handle Buddhist Era year if passed
      birthYear = y;
      birthMonth = m;
      birthDay = d;
    } else {
      const birth = new Date(birthDateString);
      if (isNaN(birth.getTime())) return 0;
      birthYear = birth.getFullYear();
      if (birthYear > 2400) birthYear -= 543;
      birthMonth = birth.getMonth();
      birthDay = birth.getDate();
    }

    let age = today.getFullYear() - birthYear;
    const mDiff = today.getMonth() - birthMonth;
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDay)) {
      age--;
    }
    return Math.max(0, age);
  } catch {
    return 0;
  }
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return 0;
  }
  const heightM = heightCm / 100;
  return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
}

export function formatThaiDate(dateString: string | undefined, includeYear: boolean = true): string {
  if (!dateString) return '-';
  try {
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    const clean = dateString.trim();
    const parts = clean.split(/[-/T ]/);
    if (parts.length >= 3) {
      let y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m < 12 && d >= 1 && d <= 31) {
        if (y < 2400) y += 543;
        const month = thaiMonths[m];
        return includeYear ? `${d} ${month} ${y}` : `${d} ${month}`;
      }
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() > 2400 ? date.getFullYear() : date.getFullYear() + 543;
    
    return includeYear ? `${day} ${month} ${year}` : `${day} ${month}`;
  } catch {
    return dateString;
  }
}

export function formatThaiBirthDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    const thaiMonthsFull = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const clean = dateString.trim();
    const parts = clean.split(/[-/T ]/);
    if (parts.length >= 3) {
      let y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d) && m >= 0 && m < 12 && d >= 1 && d <= 31) {
        if (y < 2400) y += 543;
        const month = thaiMonthsFull[m];
        return `${d} ${month} ${y}`;
      }
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate();
    const month = thaiMonthsFull[date.getMonth()];
    const year = date.getFullYear() > 2400 ? date.getFullYear() : date.getFullYear() + 543;
    
    return `${day} ${month} ${year}`;
  } catch {
    return dateString;
  }
}
