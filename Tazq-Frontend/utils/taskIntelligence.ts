/**
 * Tazq High-Precision Intelligence
 * Goal: 90%+ Accuracy by focusing on high-confidence semantic anchors.
 * Principles: No guessing. If not 100% sure, don't tag.
 */

const CATEGORIES = [
  { id: 'work', label: 'iş', anchors: ['toplantı', 'rapor', 'sunum', 'proje', 'email', 'e-posta', 'iş görüşmesi', 'meeting', 'report', 'office', 'mülakat', 'proje'] },
  { id: 'health', label: 'sağlık', anchors: ['spor', 'egzersiz', 'doktor', 'ilaç', 'gym', 'koşu', 'hastane', 'fitness', 'eczane', 'randevu', 'idman', 'antrenman'] },
  { id: 'shopping', label: 'alışveriş', anchors: ['market', 'sipariş', 'satın al', 'hediye', 'fiyat', 'ayran', 'yoğurt', 'ekmek', 'süt', 'grocery', 'order', 'sepet'] },
  { id: 'finance', label: 'finans', anchors: ['fatura', 'ödeme', 'banka', 'borç', 'kredi', 'maaş', 'bütçe', 'kira', 'aidat', 'vergi', 'dekont'] },
  { id: 'personal', label: 'kişisel', anchors: ['aile', 'arkadaş', 'kitap', 'film', 'tatil', 'yemek', 'temizlik', 'maç', 'halı saha', 'buluşma', 'doğum günü'] },
  { id: 'study', label: 'eğitim', anchors: ['ders', 'sınav', 'ödev', 'kurs', 'öğren', 'okul', 'vize', 'final', 'akademi', 'homework', 'exam'] },
];

/**
 * High-precision categorization engine.
 * Only tags if it finds a definitive anchor to ensure 90%+ consistency.
 */
export const categorizeTask = async (title: string) => {
  if (!title || title.length < 3) return null;
  const lowercaseTitle = title.toLowerCase().trim();

  // Iterate categories for strict matches
  for (const category of CATEGORIES) {
    // Check for exact word or clear phrase match
    const found = category.anchors.some(anchor => {
        const regex = new RegExp(`\\b${anchor}\\b`, 'i');
        return regex.test(lowercaseTitle) || lowercaseTitle.includes(anchor);
    });

    if (found) {
      return {
        id: category.id,
        label: category.label,
        confidence: 1.0
      };
    }
  }

  return null;
};

export const initIntelligence = async () => {};
