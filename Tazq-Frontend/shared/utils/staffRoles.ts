/**
 * Ekip rolleri (madde 9, 2026-10-30) — sunucudaki StaffRoles/StaffPolicy ile aynı kümeler:
 *   Support   → yalnız destek kutusu
 *   Analyst   → Ürün Analisti: Analiz Merkezi (segment, huni, benimseme, odak davranışı). Kişi listesi YOK.
 *   Moderator → kullanıcı listesi, ban, destek kutusu + mesaj silme
 *   Admin     → süper admin: hepsi + kişisel detay, dışa aktarma, silme, rol, sistem
 * Roller merdiven DEĞİL (Analist istatistik görür, Moderatör görmez) — yetenek başına küme.
 * İstemci yalnız GÖRÜNÜRLÜĞÜ ayarlar; asıl kapı sunucuda (rol her istekte DB'den okunur).
 */
export type StaffRole = 'User' | 'Support' | 'Analyst' | 'Moderator' | 'Admin';
export type StaffLevel = 'staff' | 'support' | 'users' | 'insights' | 'moderate' | 'super';

export const STAFF_ROLES: StaffRole[] = ['User', 'Support', 'Analyst', 'Moderator', 'Admin'];

const CAN: Record<StaffLevel, StaffRole[]> = {
  staff: ['Support', 'Analyst', 'Moderator', 'Admin'],
  support: ['Support', 'Moderator', 'Admin'],
  users: ['Moderator', 'Admin'],
  insights: ['Analyst', 'Admin'],
  moderate: ['Moderator', 'Admin'],
  super: ['Admin'],
};

export function canStaff(role: string | null | undefined, level: StaffLevel): boolean {
  return CAN[level].includes(role as StaffRole);
}

const LABELS: Record<'tr' | 'en', Record<StaffRole, string>> = {
  tr: { User: 'Kullanıcı', Support: 'Destek', Analyst: 'Ürün Analisti', Moderator: 'Moderatör', Admin: 'Süper admin' },
  en: { User: 'User', Support: 'Support', Analyst: 'Product Analyst', Moderator: 'Moderator', Admin: 'Super admin' },
};

export function roleLabel(role: string | null | undefined, lang: string): string {
  const table = LABELS[lang as 'tr' | 'en'] ?? LABELS.en;
  return table[(role ?? 'User') as StaffRole] ?? table.User;
}

/** Yalnız analiz gören rol: panel "Analiz Merkezi" olarak açılır, sekme çubuğu yok. */
export function isAnalystOnly(role: string | null | undefined): boolean {
  return canStaff(role, 'insights') && !canStaff(role, 'users') && !canStaff(role, 'support');
}

/** Rol seçicide etiketin altındaki tek satır: rol NE görür / ne yapabilir (karıştırılmasın diye). */
const DESCRIPTIONS: Record<'tr' | 'en', Record<StaffRole, string>> = {
  tr: {
    User: 'Ekip yetkisi yok — normal hesap',
    Support: 'Yalnız destek mesajlarını görür ve yanıtlar',
    Analyst: 'Analiz Merkezi: toplu istatistik; kişi ve ad görmez',
    Moderator: 'Kullanıcı listesi, ban ve destek; istatistik ve sistem yok',
    Admin: 'Her şey: kişisel detay, silme, dışa aktarma, roller, sistem',
  },
  en: {
    User: 'No team access — regular account',
    Support: 'Sees and answers support messages only',
    Analyst: 'Analytics: aggregate stats; no people or names',
    Moderator: 'User list, bans and support; no stats or system',
    Admin: 'Everything: personal detail, delete, export, roles, system',
  },
};

export function roleDescription(role: string | null | undefined, lang: string): string {
  const table = DESCRIPTIONS[lang as 'tr' | 'en'] ?? DESCRIPTIONS.en;
  return table[(role ?? 'User') as StaffRole] ?? table.User;
}
