import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Linking, Share, Modal, Platform, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Users, CheckSquare, Trash2, Shield, 
  Search, Zap, ChevronDown, ChevronUp, Ban, MessageSquare, Check, Server, RefreshCw, Power, Database, AlertTriangle, FileText, ExternalLink, BarChart3, Download, ScrollText, Smartphone, History, Megaphone,
  Sparkles, CheckCircle2,
} from 'lucide-react-native';
import { useAppTheme } from '@/shared/hooks/useAppTheme';
import { Pager } from '@/shared/components/Pager';
import { useKeyboardHeight } from '@/shared/hooks/useKeyboardHeight';
import { useLanguageStore } from '@/shared/store/useLanguageStore';
import { useAuthStore } from '@/features/user';
import { AdminService, AdminUser, AdminStats, AdminProductInsights, BanHistoryItem, AdminUserDetail, AdminAuditItem, SupportService, SupportMessageItem, AdminSystemService, SystemHealth, SystemStats, SystemLogEntry, SentrySummary, LogSource, AiStatus, AiTestResult } from '@/shared/services/api';
import { sendAdminSupportNotification } from '@/shared/utils/notifications';
import { ICON, S, R, F, B, MAX_W, HAIRLINE } from '@/shared/constants/tokens';
import { useContentMaxWidth } from '@/shared/components/ResponsiveColumns';
import { Touchable } from '@/shared/components/Touchable';
import { GlassSurface } from '@/shared/components/GlassSurface';
import { CustomAlert as Alert, AlertHost } from '@/shared/components/CustomAlert';
import { swallow } from '@/shared/utils/swallow';
import { haptic } from '@/shared/utils/haptics';
import { canStaff, roleLabel, isAnalystOnly } from '@/shared/utils/staffRoles';
import { AnalyticsToggle } from '@/features/admin/components/AnalyticsToggle';
import { CrashGroupsCard } from '@/features/admin/components/CrashGroupsCard';
import { SupportThread } from '@/shared/components/SupportThread';
import { RolePicker } from '@/features/admin/components/RolePicker';
import { AnalyticsCenter } from '@/features/admin/components/AnalyticsCenter';
import { JobHealthCard } from '@/features/admin/components/JobHealthCard';
import { UserFilterChips, type UserFilter } from '@/features/admin/components/UserFilterChips';
import { useSupportTemplates, TemplateChips, TemplatesHeader, TemplateEditor, fillTemplate, templateFallback } from '@/features/admin/components/SupportTemplates';

type SortKey = 'name' | 'tasks' | 'focus' | 'recent';

// Göreli zaman (kısa): "az önce / 5dk / 3sa / 2g"
const timeAgo = (iso: string, tr: boolean) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return tr ? 'az önce' : 'now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}${tr ? 'dk' : 'm'}`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}${tr ? 'sa' : 'h'}`;
  return `${Math.floor(h / 24)}${tr ? 'g' : 'd'}`;
};
const sentryLevelStyle = (lvl?: string | null) => {
  const l = (lvl || '').toLowerCase();
  if (l === 'fatal') return { color: '#DC2626', label: 'FATAL' };
  if (l === 'error') return { color: '#EF4444', label: 'ERROR' };
  if (l === 'warning') return { color: '#F59E0B', label: 'WARN' };
  return { color: '#6B7280', label: (lvl || 'INFO').toUpperCase() };
};
const logLevelStyle = (lvl: string) => {
  if (lvl === 'Error' || lvl === 'Critical') return { color: '#EF4444', label: 'ERR' };
  if (lvl === 'Warning') return { color: '#F59E0B', label: 'WARN' };
  return { color: '#6B7280', label: 'INFO' };
};

/**
 * Sayfa başına log sayısı. Tampon 500 kayıt tutuyor; 50'lik sayfalar hem ekrana
 * sığıyor hem 10 sayfada tamamını gezdiriyor.
 */
const LOG_PAGE_SIZE = 50;
const AUDIT_PAGE_SIZE = 40;

export default function AdminScreen() {
  const { theme, colorScheme } = useAppTheme();
  const { language } = useLanguageStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  /* Tablette içerik 600pt'lik şeride sıkışmasın — üç kademeli genişlik. */
  const contentW = useContentMaxWidth();
  /*
    Yanıt kutusu uzun bir listenin DERİNİNDE duruyor; klavye açılınca altında kalıyordu.
    Dip dolgusuna klavye yüksekliği eklenince kutu görünür alana çıkıyor.
    Not: `KeyboardAvoidingView` burada çözüm değil — ekranın tamamını iterek üstteki
    sekme çubuğunu da kaydırırdı; sorun yalnız kaydırma alanının dibinde.
  */
  const keyboardHeight = useKeyboardHeight();
  const isDark = colorScheme === 'dark';
  const tr = language === 'tr';
  const myId = useAuthStore(s => s.user?.id);
  // Ekip rolü (madde 9): görünürlük buna göre; asıl kapı sunucuda (bkz. staffRoles).
  const myRole = useAuthStore(s => s.user?.role);
  const isSuper = canStaff(myRole, 'super');
  const canModerate = canStaff(myRole, 'moderate');
  const canUsers = canStaff(myRole, 'users');
  const canInsights = canStaff(myRole, 'insights');
  const canSupport = canStaff(myRole, 'support');
  const analystOnly = isAnalystOnly(myRole);        // Ürün Analisti: kendi ekranı (Analiz Merkezi)
  const tpl = useSupportTemplates(canSupport);

  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'support' | 'system'>(() => (canModerate ? 'users' : canInsights ? 'stats' : 'support'));
  const [sysHealth, setSysHealth] = useState<SystemHealth | null>(null);
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [sysLogs, setSysLogs] = useState<SystemLogEntry[]>([]);
  const [sysSentry, setSysSentry] = useState<SentrySummary | null>(null);
  const [sysLogLevel, setSysLogLevel] = useState<string | null>(null);
  /**
   * KAYNAK FİLTRESİ — varsayılan 'Production'.
   *
   * Geliştirme sürümü de canlı API'ye bağlandığı için, kod yazarken çıkan hatalar aynı
   * havuza düşüyordu. Panelin ilk açılışta cevaplaması gereken soru "gerçek kullanıcıda
   * ne kırıldı?" — o yüzden varsayılan canlı. Geliştirme kayıtları SİLİNMİYOR, tek
   * dokunuşla geri geliyor.
   */
  const [sysLogSource, setSysLogSource] = useState<LogSource | null>('Production');
  const [sysLogPage, setSysLogPage] = useState(0);
  /** Cozulmus kilitlenmeleri gizle — panelin ilk sorusu "hala kirik olan ne?". */
  const [auditPage, setAuditPage] = useState(0);
  const [auditMeta, setAuditMeta] = useState<{ total: number; hasMore: boolean }>({ total: 0, hasMore: false });
  const [sysLogMeta, setSysLogMeta] = useState<{ total: number; hasMore: boolean; counts: Partial<Record<LogSource, number>> }>({ total: 0, hasMore: false, counts: {} });
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiTest, setAiTest] = useState<AiTestResult | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysBusy, setSysBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageItem[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [expandedMsgs, setExpandedMsgs] = useState<Record<number, boolean>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [insights, setInsights] = useState<AdminProductInsights | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedCountRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [userFilter, setUserFilter] = useState<UserFilter>('all'); const [filterCounts, setFilterCounts] = useState<Record<string, number> | null>(null);
  const [sortAsc, setSortAsc] = useState(false);
  // Kullanıcı detayı (drill-down)
  const [userDetail, setUserDetail] = useState<Record<number, AdminUserDetail>>({});
  const [detailLoadingFor, setDetailLoadingFor] = useState<number | null>(null);
  const [exportingFor, setExportingFor] = useState<number | null>(null);
  // Yazarak onaylı silme
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  // Denetim günlüğü
  const [auditLogs, setAuditLogs] = useState<AdminAuditItem[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const PAGE_SIZE = 30;
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [banPickerFor, setBanPickerFor] = useState<number | null>(null);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [banReasonCustom, setBanReasonCustom] = useState('');
  const [banHistory, setBanHistory] = useState<Record<number, BanHistoryItem[]>>({});
  const [historyLoadingFor, setHistoryLoadingFor] = useState<number | null>(null);

  const loadUsers = useCallback(async (reset: boolean) => {
    if (!canUsers) return;
    if (!reset) setLoadingMore(true);
    try {
      const startCount = reset ? 0 : loadedCountRef.current;
      const nextPage = Math.floor(startCount / PAGE_SIZE) + 1;
      const res = await AdminService.getUsers({ page: nextPage, pageSize: PAGE_SIZE, search: search.trim() || undefined, sort: sortKey, asc: sortAsc, filter: userFilter === 'all' ? undefined : userFilter });
      setTotal(res.total); if (res.counts) setFilterCounts(res.counts);
      setUsers(prev => {
        const merged = reset ? res.users : [...prev, ...res.users];
        loadedCountRef.current = merged.length;
        return merged;
      });
    } catch {
      if (reset) setError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [search, sortKey, sortAsc, userFilter, canUsers]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const [s, m, pi] = await Promise.all([
        canInsights ? AdminService.getStats() : Promise.resolve(null),
        canSupport ? SupportService.getAllMessages().catch(() => ({ messages: [], unreadCount: 0 })) : Promise.resolve({ messages: [], unreadCount: 0 }),
        canInsights ? AdminService.getProductInsights().catch(() => null) : Promise.resolve(null),
      ]);
      setStats(s);
      setInsights(pi);
      setMessages(m.messages);
      setUnreadCount(m.unreadCount);
      if (m.unreadCount > 0 && m.messages[0] && !m.messages[0].isRead) {
        sendAdminSupportNotification(m.messages[0].userName, tr);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tr, canInsights, canSupport]);

  const handleMarkRead = async (msg: SupportMessageItem) => {
    haptic.select();
    try {
      await SupportService.markAsRead(msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { swallow('admin.handleMarkRead', e); }
  };

  const performDeleteMessage = async (msg: SupportMessageItem) => {
    haptic.commit();
    try {
      await SupportService.deleteMessage(msg.id);
      setMessages(prev => prev.filter(m => m.id !== msg.id));
      if (!msg.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Mesaj silinemedi.' : 'Could not delete message.');
    }
  };

  const handleDeleteMessage = (msg: SupportMessageItem) => {
    Alert.alert(
      tr ? 'Mesajı sil?' : 'Delete message?',
      tr ? `"${msg.userName}" kullanıcısının mesajı (ve varsa yanıtın) kalıcı olarak silinecek. Bu işlem geri alınamaz.` : `This message from "${msg.userName}" (and any reply) will be permanently deleted. This cannot be undone.`,
      [
        { text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' },
        { text: tr ? 'Sil' : 'Delete', style: 'destructive', onPress: () => performDeleteMessage(msg) },
      ],
    );
  };

  const handleReply = async (msg: SupportMessageItem) => {
    const text = (replyDrafts[msg.id] || '').trim();
    if (!text) return;
    setReplyingId(msg.id);
    haptic.success();
    try {
      await SupportService.replyMessage(msg.id, text);
      const now = new Date().toISOString(); // konuşmaya ekle (ikinci yanıt birincinin üstüne yazılmaz)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, adminReply: text, repliedAt: now, isRead: true, thread: [...(m.thread ?? []), { fromStaff: true, body: text, at: now }] } : m));
      if (!msg.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
      setReplyDrafts(d => ({ ...d, [msg.id]: '' }));
    } catch {
      Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Yanıt gönderilemedi. Lütfen tekrar dene.' : 'Could not send reply. Please try again.');
    } finally {
      setReplyingId(null);
    }
  };

  const handleStaffClose = (msg: SupportMessageItem) => Alert.alert(tr ? 'Konuşmayı bitir' : 'End conversation', tr ? 'Kullanıcı bu konuşmaya artık yazamaz.' : 'The user can no longer reply here.', [
    { text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' },
    { text: tr ? 'Bitir' : 'End', style: 'destructive', onPress: async () => {
      try { await SupportService.staffClose(msg.id); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, closedAt: new Date().toISOString(), closedBy: 'staff', isRead: true } : m)); }
      catch { Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Kapatılamadı.' : 'Could not close.'); }
    } },
  ]);

  useEffect(() => { load(); }, [load]);

  // Kullanıcılar: ilk yükleme + arama/sıralama değişiminde (arama debounce'lu) sunucudan çek
  useEffect(() => {
    const id = setTimeout(() => { loadUsers(true); }, search ? 400 : 0);
    return () => clearTimeout(id);
  }, [loadUsers, search]);

  // ── Sistem konsolu ──────────────────────────────────────────────────────────
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const page = await AdminService.getAuditLog({ limit: AUDIT_PAGE_SIZE, offset: auditPage * AUDIT_PAGE_SIZE });
      setAuditLogs(page.items);
      setAuditMeta({ total: page.total, hasMore: page.hasMore });
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage]);

  const loadSystem = useCallback(async () => {
    setSysLoading(true);
    try {
      const [h, s, l, se, ai] = await Promise.all([
        AdminSystemService.health().catch(() => null),
        AdminSystemService.stats().catch(() => null),
        AdminSystemService.logs({ limit: LOG_PAGE_SIZE, offset: sysLogPage * LOG_PAGE_SIZE, level: sysLogLevel || undefined, source: sysLogSource || undefined })
          .catch(() => ({ logs: [] as SystemLogEntry[], total: 0, offset: 0, limit: LOG_PAGE_SIZE, hasMore: false, counts: {} })),
        AdminSystemService.sentry().catch(() => null),
        AdminSystemService.aiStatus().catch(() => null),
      ]);
      setSysHealth(h);
      setSysStats(s);
      setSysLogs(l.logs || []);
      setSysLogMeta({ total: l.total ?? 0, hasMore: l.hasMore ?? false, counts: l.counts ?? {} });
      setSysSentry(se);
      setAiStatus(ai);
    } finally {
      setSysLoading(false);
    }
  }, [sysLogLevel, sysLogSource, sysLogPage]);

  // Filtre değişince sayfa başa dönmeli: 4. sayfadayken filtreyi daraltınca sonuç
  // 2 sayfaya düşüyor ve kullanıcı boş bir sayfaya bakıyordu.
  useEffect(() => { setSysLogPage(0); }, [sysLogLevel, sysLogSource]);

  useEffect(() => { if (activeTab === 'system') { loadSystem(); loadAudit(); } }, [activeTab, loadSystem, loadAudit]);

  const runMaintenance = (key: string, fn: () => Promise<any>, title: string, body: string) => {
    Alert.alert(title, body, [
      { text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' },
      {
        text: tr ? 'Devam' : 'Proceed', style: 'destructive', onPress: async () => {
          setSysBusy(key);
          haptic.destructive();
          try {
            const r = await fn();
            Alert.alert(tr ? 'Tamam' : 'Done', r?.message || (tr ? 'İşlem tamamlandı.' : 'Operation completed.'));
            setTimeout(loadSystem, 1500);
          } catch {
            Alert.alert(tr ? 'Hata' : 'Error', tr ? 'İşlem başarısız oldu.' : 'Operation failed.');
          } finally {
            setSysBusy(null);
          }
        }
      },
    ]);
  };

  // Arama/sıralama artık sunucu tarafında — liste doğrudan `users`
  const filteredUsers = users;

  const loadUserDetail = useCallback(async (userId: number) => {
    setDetailLoadingFor(userId);
    try {
      const d = await AdminService.getUserDetail(userId);
      setUserDetail(prev => ({ ...prev, [userId]: d }));
    } catch {
      // sessiz
    } finally {
      setDetailLoadingFor(null);
    }
  }, []);

  const handleExport = async (user: AdminUser) => {
    setExportingFor(user.id);
    haptic.select();
    try {
      const data = await AdminService.exportUser(user.id);
      await Share.share({
        title: `Tazq-Export-${user.email}.json`,
        message: JSON.stringify(data, null, 2),
      });
    } catch {
      Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Dışa aktarılamadı.' : 'Export failed.');
    } finally {
      setExportingFor(null);
    }
  };


  const DELETE_WORD = tr ? 'SİL' : 'DELETE';

  const handleDelete = (user: AdminUser) => {
    // Yazarak onaylı modal — yıkıcı hard-delete için ekstra sürtünme
    haptic.destructive();
    setDeleteConfirmText('');
    setDeleteTarget(user);
  };

  const performTypedDelete = async () => {
    if (!deleteTarget || deleting) return;
    if (deleteConfirmText.trim().toLocaleUpperCase(tr ? 'tr-TR' : 'en-US') !== DELETE_WORD) return;
    setDeleting(true);
    try {
      await AdminService.deleteUser(deleteTarget.id);
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      loadedCountRef.current = Math.max(0, loadedCountRef.current - 1);
      setTotal(t => Math.max(0, t - 1));
      haptic.success();
      Keyboard.dismiss();
      setDeleteTarget(null);
    } catch {
      Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Silinemedi.' : 'Could not delete.');
    } finally {
      setDeleting(false);
    }
  };

  // Rol seçici: her rolün altında ne gördüğü yazar (bkz. RolePicker).
  const [rolePickFor, setRolePickFor] = useState<AdminUser | null>(null);
  const handleSetRole = (user: AdminUser) => { haptic.select(); setRolePickFor(user); };
  const applyRole = async (user: AdminUser, role: string) => {
    setRolePickFor(null);
    try {
      await AdminService.setRole(user.id, role);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role } : u));
    } catch {
      Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Değiştirilemedi.' : 'Could not update.');
    }
  };

  const loadBanHistory = useCallback(async (userId: number) => {
    setHistoryLoadingFor(userId);
    try {
      const h = await AdminService.getBanHistory(userId);
      setBanHistory(prev => ({ ...prev, [userId]: h }));
    } catch {
      setBanHistory(prev => ({ ...prev, [userId]: prev[userId] || [] }));
    } finally {
      setHistoryLoadingFor(null);
    }
  }, []);

  const performBan = async (user: AdminUser, durationDays: number | null, reason: string) => {
    setBanPickerFor(null);
    setBanReason(null);
    setBanReasonCustom('');
    haptic.success();
    try {
      await AdminService.setBan(user.id, true, durationDays, reason);
      const bannedUntil = durationDays ? new Date(Date.now() + durationDays * 86400000).toISOString() : null;
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isBanned: !durationDays, bannedUntil, banReason: reason } : u));
      loadBanHistory(user.id);
    } catch {
      Alert.alert(tr ? 'Hata' : 'Error', tr ? 'İşlem başarısız.' : 'Action failed.');
    }
  };

  const performUnban = (user: AdminUser) => {
    haptic.commit();
    Alert.alert(
      tr ? 'Banı Kaldır' : 'Unban User',
      tr ? `${user.name} tekrar giriş yapabilecek.` : `${user.name} will be able to log in again.`,
      [
        { text: tr ? 'İptal' : 'Cancel', style: 'cancel' },
        { text: tr ? 'Banı Kaldır' : 'Unban', onPress: async () => {
          try {
            await AdminService.setBan(user.id, false);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isBanned: false, bannedUntil: null, banReason: null } : u));
            loadBanHistory(user.id);
            haptic.success();
          } catch {
            Alert.alert(tr ? 'Hata' : 'Error', tr ? 'İşlem başarısız.' : 'Action failed.');
          }
        }},
      ]
    );
  };

  const cycleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(false); }
    haptic.select();
  };

  const formatLastSeen = (iso?: string) => {
    if (!iso) return tr ? 'Hiç giriş yok' : 'Never';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)     return tr ? 'Az önce' : 'Just now';
    if (diff < 3600)   return `${Math.floor(diff / 60)}${tr ? ' dk önce' : 'm ago'}`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}${tr ? ' sa önce' : 'h ago'}`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}${tr ? ' gün önce' : 'd ago'}`;
    return new Date(iso).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const cardBg     = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    return (
      <Touchable
        onPress={() => cycleSort(k)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: active ? theme.primary + '20' : cardBg, borderWidth: B.thin, borderColor: active ? theme.primary + '40' : cardBorder }}
      >
        <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? theme.primary : theme.onSurfaceVariant }}>{label}</Text>
        {active && (sortAsc ? <ChevronUp size={ICON.xs} color={theme.primary} /> : <ChevronDown size={ICON.xs} color={theme.primary} />)}
      </Touchable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingTop: S.sm, paddingBottom: S.md, gap: S.sm }}>
        <Touchable accessibilityRole="button" accessibilityLabel={tr ? 'Geri' : 'Back'} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: cardBg, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={ICON.md} color={theme.onSurface} />
        </Touchable>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flex: 1, fontSize: F.title, fontWeight: '700', color: theme.onSurface, letterSpacing: -0.5 }}>
          {analystOnly ? (tr ? 'Analiz Merkezi' : 'Analytics') : (tr ? 'Admin Paneli' : 'Admin Panel')}
        </Text>
        {isSuper && <Touchable
          onPress={() => { router.push('/promo'); }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: '#10B98115', borderWidth: B.thin, borderColor: '#10B98140', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.sm }}
          accessibilityRole="button"
          accessibilityLabel={tr ? 'Tanıtım görselleri' : 'Promo images'}
        >
          <Megaphone size={ICON.xs} color="#10B981" />
          <Text style={{ fontSize: F.caption, fontWeight: '700', color: '#10B981' }}>{tr ? 'Tanıtım' : 'Promo'}</Text>
        </Touchable>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: '#6366F115', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xs }}>
          <Shield size={ICON.xs} color="#6366F1" />
          <Text style={{ fontSize: F.caption, fontWeight: '700', color: '#6366F1' }}>{roleLabel(myRole, language).toLocaleUpperCase(tr ? 'tr-TR' : 'en-US')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md }}>
          <Text style={{ color: theme.error, fontWeight: '700', fontSize: F.subhead }}>
            {tr ? 'Yüklenemedi' : 'Failed to load'}
          </Text>
          <Touchable onPress={() => load()} style={{ backgroundColor: theme.primary + '15', paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full }}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>{tr ? 'Tekrar Dene' : 'Retry'}</Text>
          </Touchable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: insets.bottom + S.xl + keyboardHeight, gap: S.md, width: '100%', maxWidth: contentW, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); loadUsers(true); }} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={theme.surface} />}
          showsVerticalScrollIndicator={false}
          /*
            KLAVYE AÇIKKEN DE DOKUNULABİLSİN.
            Varsayılan davranış ("never") klavye açıkken ilk dokunuşu KLAVYEYİ KAPATMAK
            için yutar; kullanıcı "Gönder"e basar, bir şey olmaz, tekrar basar. Destek
            yanıt kutusu tam da bunu yaşatıyordu.
          */
          keyboardShouldPersistTaps="handled"
          stickyHeaderIndices={[0]}
        >
          {/* Sekmeler — yapışkan (kaydırınca kaybolmuyordu: "karmaşa hakim" turu). Analist tek ekran görür. */}
          <View style={{ backgroundColor: theme.background, paddingVertical: S.xs, display: analystOnly ? 'none' : 'flex' }}>
          <View style={{ flexDirection: 'row', backgroundColor: cardBg, borderRadius: R.full, padding: S.xs, borderWidth: B.thin, borderColor: cardBorder }}>
            {([
              { key: 'users', icon: Users, label: tr ? 'Kullanıcı' : 'Users' },
              { key: 'stats', icon: BarChart3, label: tr ? 'Analiz' : 'Analytics' },
              { key: 'support', icon: MessageSquare, label: tr ? 'Destek' : 'Support', badge: unreadCount },
              { key: 'system', icon: Server, label: tr ? 'Sistem' : 'System', dot: !!sysHealth && (sysHealth.errors > 0 || !sysHealth.dbOk) },
            ] as const).filter(tb => ({ users: canUsers, stats: canInsights, support: canSupport, system: isSuper })[tb.key]).map((tb) => {
              const active = activeTab === tb.key;
              const Icon = tb.icon;
              return (
                <Touchable key={tb.key} onPress={() => { haptic.select(); setActiveTab(tb.key as any); }}
                  style={{ flex: 1, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: active ? theme.primary : 'transparent', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: S.xs }}>
                  <Icon size={14} color={active ? '#FFF' : theme.onSurfaceVariant} />
                  <Text numberOfLines={1} style={{ color: active ? '#FFF' : theme.onSurfaceVariant, fontWeight: '700', fontSize: F.caption }}>{tb.label}</Text>
                  {'badge' in tb && (tb as any).badge > 0 && (
                    <View style={{ backgroundColor: '#EF4444', borderRadius: R.sm, paddingHorizontal: S.xs, paddingVertical: S.xxs }}>
                      <Text style={{ color: '#FFF', fontSize: F.caption, fontWeight: '700' }}>{(tb as any).badge}</Text>
                    </View>
                  )}
                  {'dot' in tb && (tb as any).dot && <View style={{ width: 6, height: 6, borderRadius: R.full, backgroundColor: '#EF4444' }} />}
                </Touchable>
              );
            })}
          </View>
          </View>

          {/* ── ANALİZ sekmesi: bkz. AnalyticsCenter ── */}
          {activeTab === 'stats' && stats && (
            <AnalyticsCenter lang={language === 'tr' ? 'tr' : 'en'} stats={stats} insights={insights} />
          )}

          {activeTab === 'users' ? (
            <>
              {/* ── Search + Sort ── */}
              <View style={{ gap: S.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: cardBorder, paddingHorizontal: S.sm, paddingVertical: S.xs }}>
              <Search size={ICON.sm} color={theme.onSurfaceVariant} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={tr ? 'İsim veya e-posta ara…' : 'Search name or email…'}
                placeholderTextColor={theme.onSurfaceVariant + '60'}
                style={{ flex: 1, fontSize: F.body, color: theme.onSurface, paddingVertical: S.xs }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
              <SortBtn k="recent" label={tr ? 'Son Aktif' : 'Recent'} />
              <SortBtn k="focus"  label={tr ? 'Odak' : 'Focus'} />
              <SortBtn k="tasks"  label={tr ? 'Görev' : 'Tasks'} />
              <SortBtn k="name"   label={tr ? 'İsim' : 'Name'} />
            </View>
            <UserFilterChips value={userFilter} counts={filterCounts} total={total} onChange={setUserFilter} lang={tr ? 'tr' : 'en'} />
          </View>

          {/* ── User count ── */}
          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, letterSpacing: 0.8 }}>
            {tr ? 'KULLANICILAR' : 'USERS'} ({users.length}/{total})
          </Text>

          {/* ── User list ── */}
          {filteredUsers.map((user, i) => {
            const isExpanded = expandedUser === user.id;
            const completionRate = user.taskCount > 0 ? Math.round((user.completedTasks / user.taskCount) * 100) : 0;
            const focusHrs = (user.focusMinutes / 60).toFixed(1);
            const isStaffUser = canStaff(user.role, 'staff');
            const isSelf = user.id === myId;
            const tempBanActive = !!user.bannedUntil && new Date(user.bannedUntil).getTime() > Date.now();
            const isBanned = !!user.isBanned || tempBanActive;
            const isDeleted = !!user.deletedAt;
            const banUntilLabel = tempBanActive
              ? new Date(user.bannedUntil!).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : null;

            return (
              <MotiView
                key={user.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 280, delay: Math.min(i * 30, 300) }}
                style={{ backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: isStaffUser ? '#6366F130' : cardBorder, overflow: 'hidden' }}
              >
                {/* Main row */}
                <Touchable
                  onPress={() => { const opening = !isExpanded; setExpandedUser(opening ? user.id : null); if (opening && canModerate && banHistory[user.id] === undefined) loadBanHistory(user.id); if (opening && isSuper && userDetail[user.id] === undefined) loadUserDetail(user.id); setBanPickerFor(null); haptic.select(); }}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.sm }}
                  activeOpacity={0.7}
                >
                  {/* Avatar */}
                  <View style={{ width: 42, height: 42, borderRadius: R.full, backgroundColor: isStaffUser ? '#6366F125' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: F.subhead, fontWeight: '700', color: isStaffUser ? '#6366F1' : theme.onSurface }}>
                      {(user.name || user.email)[0].toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, gap: S.xxs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                      <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface }} numberOfLines={1}>{user.name}</Text>
                      {isStaffUser && (
                        <View style={{ backgroundColor: '#6366F115', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xxs }}>
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: '#6366F1' }}>{roleLabel(user.role, language).toLocaleUpperCase(tr ? 'tr-TR' : 'en-US')}</Text>
                        </View>
                      )}
                      {isBanned && (
                        <View style={{ backgroundColor: theme.error + '20', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xxs }}>
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.error }}>{tempBanActive ? (tr ? 'SÜRELİ BAN' : 'TEMP BAN') : (tr ? 'BANLI' : 'BANNED')}</Text>
                        </View>
                      )}
                      {isDeleted && (
                        <View style={{ backgroundColor: theme.onSurfaceVariant + '25', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xxs }}>
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant }}>{tr ? 'SİLİNMİŞ' : 'DELETED'}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }} numberOfLines={1}>{user.email}</Text>
                    <View style={{ flexDirection: 'row', gap: S.sm, marginTop: S.xxs }}>
                      <Text style={{ fontSize: 10, color: theme.onSurfaceMuted }}>
                        {user.taskCount} {tr ? 'görev' : 'tasks'} · {focusHrs}h
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.onSurfaceMuted }}>
                        {formatLastSeen(user.lastActivityAt)}
                      </Text>
                    </View>
                  </View>

                  {isExpanded ? <ChevronUp size={ICON.sm} color={theme.onSurfaceVariant} /> : <ChevronDown size={ICON.sm} color={theme.onSurfaceVariant} />}
                </Touchable>

                {/* Expanded detail */}
                {isExpanded && (
                  <View style={{ borderTopWidth: HAIRLINE, borderTopColor: theme.separator, padding: S.md, gap: S.md }}>
                    {/* Stat row */}
                    <View style={{ flexDirection: 'row', gap: S.sm }}>
                      {[
                        { label: tr ? 'Toplam Görev' : 'Total Tasks', value: user.taskCount, color: '#8B5CF6' },
                        { label: tr ? 'Tamamlanan' : 'Completed', value: user.completedTasks, color: '#10B981' },
                        { label: tr ? 'Odak (saat)' : 'Focus (hrs)', value: focusHrs, color: '#F59E0B' },
                      ].map(s => (
                        <View key={s.label} style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: R.sm, padding: S.sm, alignItems: 'center', gap: S.xxs }}>
                          <Text style={{ fontSize: F.subhead, fontWeight: '700', color: s.color }}>{s.value}</Text>
                          <Text style={{ fontSize: F.caption, fontWeight: '600', color: theme.onSurfaceVariant, textAlign: 'center' }}>{s.label}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Completion mini bar */}
                    {user.taskCount > 0 && (
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.xs }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant }}>{tr ? 'Tamamlanma oranı' : 'Completion rate'}</Text>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#10B981' }}>{completionRate}%</Text>
                        </View>
                        <View style={{ height: 5, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: R.full, overflow: 'hidden' }}>
                          <View style={{ width: `${completionRate}%`, height: '100%', backgroundColor: '#10B981', borderRadius: R.full }} />
                        </View>
                      </View>
                    )}

                    {/* IP */}
                    {user.lastLoginIp && (
                      <Text style={{ fontSize: 10, color: theme.onSurfaceMuted }}>
                        IP: {user.lastLoginIp}
                      </Text>
                    )}

                    {/* Kullanıcı detayı (drill-down) + KVKK export — yalnız süper admin (kişisel veri) */}
                    {isSuper && <View style={{ gap: S.sm, borderTopWidth: HAIRLINE, borderTopColor: theme.separator, paddingTop: S.sm }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.5 }}>
                          {tr ? 'KULLANICI DETAYI' : 'USER DETAIL'}
                        </Text>
                        {isSuper && (
                        <Touchable onPress={() => handleExport(user)} disabled={exportingFor === user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: theme.primary + '15', paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full }}>
                          {exportingFor === user.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Download size={ICON.xs} color={theme.primary} />}
                          <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '700' }}>{tr ? 'Verisini Dışa Aktar' : 'Export Data'}</Text>
                        </Touchable>
                        )}
                      </View>
                      {detailLoadingFor === user.id && !userDetail[user.id] ? (
                        <ActivityIndicator size="small" color={theme.primary} style={{ alignSelf: 'flex-start' }} />
                      ) : userDetail[user.id] ? (
                        <View style={{ gap: S.sm }}>
                          <Text style={{ fontSize: 10, color: theme.onSurfaceMuted }}>
                            {tr ? 'E-posta' : 'Email'}: {userDetail[user.id]!.isEmailVerified ? (tr ? 'doğrulandı ✓' : 'verified ✓') : (tr ? 'doğrulanmadı ✗' : 'unverified ✗')}
                            {userDetail[user.id]!.phoneNumber ? ` · ${userDetail[user.id]!.phoneNumber}` : ''}
                          </Text>
                          {(userDetail[user.id]!.devices.length > 0) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                              <Smartphone size={ICON.xs} color={theme.onSurfaceVariant} />
                              <Text style={{ fontSize: 10, color: theme.onSurfaceMuted }}>
                                {userDetail[user.id]!.devices.filter(d => !d.revokedAt).length} {tr ? 'aktif oturum' : 'active sessions'} · {userDetail[user.id]!.devices.length} {tr ? 'toplam' : 'total'}
                              </Text>
                            </View>
                          )}
                          {userDetail[user.id]!.recentTasks.length > 0 && (
                            <View style={{ gap: S.xxs }}>
                              <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted }}>{tr ? 'SON GÖREVLER' : 'RECENT TASKS'}</Text>
                              {userDetail[user.id]!.recentTasks.slice(0, 5).map(t => (
                                <Text key={t.id} numberOfLines={1} style={{ fontSize: 10, color: theme.onSurface }}>
                                  {t.isCompleted ? '✓' : '○'} {t.title || (tr ? '(başlıksız)' : '(untitled)')}
                                </Text>
                              ))}
                            </View>
                          )}
                          {userDetail[user.id]!.recentSessions.length > 0 && (
                            <View style={{ gap: S.xxs }}>
                              <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted }}>{tr ? 'SON ODAK SEANSLARI' : 'RECENT FOCUS'}</Text>
                              {userDetail[user.id]!.recentSessions.slice(0, 5).map(s => (
                                <Text key={s.id} numberOfLines={1} style={{ fontSize: 10, color: theme.onSurface }}>
                                  {s.durationMinutes}{tr ? 'dk' : 'm'} · {new Date(s.startedAt).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })} · {s.taskName}
                                </Text>
                              ))}
                            </View>
                          )}
                          {userDetail[user.id]!.recentTasks.length === 0 && userDetail[user.id]!.recentSessions.length === 0 && (
                            <Text style={{ fontSize: 10, color: theme.onSurfaceMuted }}>{tr ? 'Aktivite yok' : 'No activity'}</Text>
                          )}
                        </View>
                      ) : null}
                    </View>}

                    {/* Ban durumu notu */}
                    {isBanned && (
                      <View style={{ gap: S.xxs }}>
                        <Text style={{ fontSize: 10, color: theme.error, fontWeight: '700' }}>
                          {tempBanActive
                            ? (tr ? `Ban bitişi: ${banUntilLabel}` : `Ban ends: ${banUntilLabel}`)
                            : (tr ? 'Kalıcı ban' : 'Permanent ban')}
                        </Text>
                        {!!user.banReason && (
                          <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, fontWeight: '600' }}>
                            {tr ? `Sebep: ${user.banReason}` : `Reason: ${user.banReason}`}
                          </Text>
                        )}
                      </View>
                    )}
                    {isDeleted && (
                      <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, fontWeight: '600' }}>
                        {tr
                          ? `Kullanıcı tarafından silindi · ${new Date(user.deletedAt!).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : `Deleted by user · ${new Date(user.deletedAt!).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                      </Text>
                    )}

                    {/* Action buttons */}
                    {isSelf ? (
                      <View style={{ alignItems: 'center', paddingVertical: S.xs }}>
                        <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceMuted }}>
                          {tr ? 'Bu senin hesabın' : 'This is your account'}
                        </Text>
                      </View>
                    ) : isDeleted ? (
                      !isSuper ? null : <Touchable
                        onPress={() => handleDelete(user)}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm, borderRadius: R.md, backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)', borderWidth: B.thin, borderColor: theme.error + '40' }}
                      >
                        <Trash2 size={ICON.sm} color={theme.error} />
                        <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.error }}>
                          {tr ? 'Kalıcı Sil (Hard Delete)' : 'Permanently Delete'}
                        </Text>
                      </Touchable>
                    ) : (
                      <View style={{ gap: S.sm }}>
                        {isSuper && <Touchable
                          onPress={() => handleSetRole(user)}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm, borderRadius: R.md, backgroundColor: isStaffUser ? '#6366F115' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), borderWidth: B.thin, borderColor: isStaffUser ? '#6366F130' : cardBorder }}
                        >
                          <Shield size={ICON.sm} color={isStaffUser ? '#6366F1' : theme.onSurfaceVariant} />
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: isStaffUser ? '#6366F1' : theme.onSurfaceVariant }}>
                            {tr ? `Rol: ${roleLabel(user.role, language)}` : `Role: ${roleLabel(user.role, language)}`}
                          </Text>
                        </Touchable>}
                        {isSuper && <AnalyticsToggle userId={user.id} role={user.role} include={user.analyticsInclude} lang={tr ? 'tr' : 'en'}
                          onChange={v => setUsers(prev => prev.map(u => u.id === user.id ? { ...u, analyticsInclude: v } : u))} />}

                        {canModerate && <View style={{ flexDirection: 'row', gap: S.sm }}>
                          <Touchable
                            onPress={() => { haptic.select(); if (isBanned) { performUnban(user); } else { const open = banPickerFor !== user.id; setBanPickerFor(open ? user.id : null); if (open) { setBanReason(null); setBanReasonCustom(''); } } }}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm, borderRadius: R.md, backgroundColor: isBanned ? '#10B98115' : (banPickerFor === user.id ? '#F59E0B22' : (isDark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.07)')), borderWidth: B.thin, borderColor: isBanned ? '#10B98140' : '#F59E0B40' }}
                          >
                            {isBanned ? <CheckSquare size={ICON.sm} color="#10B981" /> : <Ban size={ICON.sm} color="#F59E0B" />}
                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: isBanned ? '#10B981' : '#F59E0B' }}>
                              {isBanned ? (tr ? 'Banı Kaldır' : 'Unban') : (tr ? 'Banla' : 'Ban')}
                            </Text>
                          </Touchable>

                          {isSuper && <Touchable
                            onPress={() => handleDelete(user)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm, borderRadius: R.md, backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderWidth: B.thin, borderColor: theme.error + '30' }}
                          >
                            <Trash2 size={ICON.sm} color={theme.error} />
                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.error }}>
                              {tr ? 'Hesabı Sil' : 'Delete'}
                            </Text>
                          </Touchable>}
                        </View>}

                        {/* Ban sebebi + süre seçici */}
                        {banPickerFor === user.id && !isBanned && (() => {
                          const reasonOptions = tr
                            ? ['Spam', 'Taciz / Hakaret', 'Kötüye kullanım', 'Sahte hesap', 'Şüpheli aktivite', 'Diğer']
                            : ['Spam', 'Harassment', 'Abuse', 'Fake account', 'Suspicious activity', 'Other'];
                          const isOther = banReason === 'Diğer' || banReason === 'Other';
                          const effectiveReason = isOther ? banReasonCustom.trim() : (banReason || '');
                          const reasonReady = isOther ? effectiveReason.length > 0 : !!banReason;
                          return (
                          <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }} style={{ gap: S.sm, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: R.md, borderWidth: B.thin, borderColor: cardBorder, padding: S.sm }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.5 }}>
                              {tr ? 'BAN SEBEBİ' : 'BAN REASON'}
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
                              {reasonOptions.map((opt) => {
                                const active = banReason === opt;
                                return (
                                  <Touchable
                                    key={opt}
                                    onPress={() => { haptic.select(); setBanReason(opt); }}
                                    style={{ paddingHorizontal: S.sm, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: active ? theme.primary + '22' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'), borderWidth: B.thin, borderColor: active ? theme.primary + '55' : cardBorder }}
                                  >
                                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? theme.primary : theme.onSurfaceVariant }}>{opt}</Text>
                                  </Touchable>
                                );
                              })}
                            </View>
                            {isOther && (
                              <TextInput
                                value={banReasonCustom}
                                onChangeText={setBanReasonCustom}
                                placeholder={tr ? 'Sebebi yaz…' : 'Type a reason…'}
                                placeholderTextColor={theme.onSurfaceVariant + '70'}
                                maxLength={200}
                                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.sm, fontSize: F.caption, color: theme.onSurface, borderWidth: B.thin, borderColor: cardBorder }}
                              />
                            )}

                            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.5, marginTop: S.xxs }}>
                              {tr ? 'BAN SÜRESİ' : 'BAN DURATION'}{!reasonReady ? (tr ? ' · önce sebep seç' : ' · pick a reason first') : ''}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: S.xs, opacity: reasonReady ? 1 : 0.4 }}>
                              {[
                                { label: tr ? '1 Gün' : '1 Day', d: 1 as number | null },
                                { label: tr ? '7 Gün' : '7 Days', d: 7 as number | null },
                                { label: tr ? '30 Gün' : '30 Days', d: 30 as number | null },
                                { label: tr ? 'Kalıcı' : 'Forever', d: null as number | null },
                              ].map((opt) => {
                                const perm = opt.d === null;
                                return (
                                  <Touchable
                                    key={opt.label}
                                    disabled={!reasonReady}
                                    onPress={() => performBan(user, opt.d, effectiveReason)}
                                    style={{ flex: 1, paddingVertical: S.sm, borderRadius: R.md, alignItems: 'center', backgroundColor: perm ? theme.error + '15' : (isDark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)'), borderWidth: B.thin, borderColor: perm ? theme.error + '40' : '#F59E0B40' }}
                                  >
                                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: perm ? theme.error : '#F59E0B' }}>{opt.label}</Text>
                                  </Touchable>
                                );
                              })}
                            </View>
                          </MotiView>
                          );
                        })()}
                      </View>
                    )}

                    {/* Ban geçmişi */}
                    {(banHistory[user.id]?.length ?? 0) > 0 && (
                      <View style={{ gap: S.sm, borderTopWidth: HAIRLINE, borderTopColor: theme.separator, paddingTop: S.sm }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: theme.onSurfaceMuted, letterSpacing: 0.5 }}>
                          {tr ? 'BAN GEÇMİŞİ' : 'BAN HISTORY'}
                        </Text>
                        {banHistory[user.id]!.map((h) => {
                          const isBan = h.action === 'ban';
                          const dur = h.durationDays ? (tr ? `${h.durationDays} gün` : `${h.durationDays}d`) : (tr ? 'kalıcı' : 'permanent');
                          return (
                            <View key={h.id} style={{ flexDirection: 'row', gap: S.sm, alignItems: 'flex-start' }}>
                              <View style={{ backgroundColor: (isBan ? theme.error : '#10B981') + '18', borderRadius: R.xs, paddingHorizontal: S.sm, paddingVertical: S.xxs, marginTop: S.xxs }}>
                                <Text style={{ fontSize: F.caption, fontWeight: '700', color: isBan ? theme.error : '#10B981' }}>{isBan ? 'BAN' : (tr ? 'KALDIR' : 'UNBAN')}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: F.caption, color: theme.onSurface, fontWeight: '600' }}>
                                  {isBan ? `${h.reason || '—'} · ${dur}` : (tr ? 'Ban kaldırıldı' : 'Ban lifted')}
                                </Text>
                                <Text style={{ fontSize: F.caption, color: theme.onSurfaceMuted }}>
                                  {new Date(h.createdAt).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{h.adminName ? ` · ${h.adminName}` : ''}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}
              </MotiView>
            );
          })}

          {filteredUsers.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
              <Text style={{ color: theme.onSurfaceMuted, fontWeight: '600' }}>
                {tr ? 'Kullanıcı bulunamadı' : 'No users found'}
              </Text>
            </View>
          )}

          {/* Daha fazla yükle (sunucu sayfalama) */}
          {users.length > 0 && users.length < total && (
            <Touchable
              onPress={() => loadUsers(false)}
              disabled={loadingMore}
              style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: theme.primary + '15', paddingHorizontal: S.lg, paddingVertical: S.sm, borderRadius: R.full, marginTop: S.xs }}
            >
              {loadingMore ? <ActivityIndicator size="small" color={theme.primary} /> : <ChevronDown size={ICON.sm} color={theme.primary} />}
              <Text style={{ color: theme.primary, fontWeight: '700', fontSize: F.caption }}>
                {tr ? `Daha fazla (${users.length}/${total})` : `Load more (${users.length}/${total})`}
              </Text>
            </Touchable>
          )}
            </>
          ) : activeTab === 'support' ? (
            <View style={{ gap: S.md }}>
              {tpl.templates.length > 0 && (
                <TemplatesHeader lang={language === 'tr' ? 'tr' : 'en'} canEdit={canModerate} onEdit={() => setTemplatesOpen(true)} />
              )}
              <TemplateEditor lang={language === 'tr' ? 'tr' : 'en'} visible={templatesOpen} templates={tpl.templates}
                onClose={() => setTemplatesOpen(false)} onSave={tpl.save} />
              {messages.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
                  <Text style={{ color: theme.onSurfaceMuted, fontWeight: '600' }}>
                    {tr ? 'Henüz destek mesajı bulunmuyor.' : 'No support messages yet.'}
                  </Text>
                </View>
              ) : (
                messages.map((m) => (
                  <View
                    key={m.id}
                    style={{
                      backgroundColor: m.isRead ? cardBg : (isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)'),
                      borderRadius: R.lg,
                      borderWidth: m.isRead ? B.thin : 2,
                      borderColor: m.isRead ? cardBorder : '#3B82F680',
                      padding: S.md,
                      gap: S.sm,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                          <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{m.userName}</Text>
                          {!m.isRead && (
                            <View style={{ backgroundColor: '#3B82F6', borderRadius: R.xs, paddingHorizontal: S.sm, paddingVertical: S.xxs }}>
                              <Text style={{ color: '#FFF', fontSize: F.caption, fontWeight: '700' }}>{tr ? 'YENİ' : 'NEW'}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{m.userEmail}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: S.sm }}>
                        <Text style={{ color: theme.onSurfaceMuted, fontSize: 10 }}>
                          {new Date(m.createdAt).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {canModerate && (
                        <Touchable
                          onPress={() => handleDeleteMessage(m)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ width: 28, height: 28, borderRadius: R.full, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.error + '12' }}
                          accessibilityRole="button"
                          accessibilityLabel={tr ? 'Mesajı sil' : 'Delete message'}
                        >
                          <Trash2 size={ICON.sm} color={theme.error} />
                        </Touchable>
                        )}
                      </View>
                    </View>
                    <Text
                      numberOfLines={expandedMsgs[m.id] ? undefined : 4}
                      style={{ color: theme.onSurface, fontSize: F.body, lineHeight: 20, paddingVertical: S.xs }}
                    >
                      {m.message}
                    </Text>
                    {m.message.length > 160 && (
                      <Touchable onPress={() => setExpandedMsgs(e => ({ ...e, [m.id]: !e[m.id] }))} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Text style={{ color: '#3B82F6', fontSize: F.caption, fontWeight: '700' }}>
                          {expandedMsgs[m.id] ? (tr ? 'Daha az' : 'Show less') : (tr ? 'Devamını oku' : 'Read more')}
                        </Text>
                      </Touchable>
                    )}

                    {/* Konuşma (2026-10-31): ilk mesaj yukarıda; devamı + yanıt kutusu + bitir (bkz. SupportThread). */}
                    <SupportThread
                      entries={(m.thread ?? [{ fromStaff: false, body: m.message, at: m.createdAt }, ...(m.adminReply ? [{ fromStaff: true, body: m.adminReply, at: m.repliedAt ?? m.createdAt }] : [])]).slice(1)}
                      viewer="staff" otherName={m.userName} lang={tr ? 'tr' : 'en'} closedBy={m.closedBy ?? null}
                      draft={replyDrafts[m.id] || ''} onDraft={t => setReplyDrafts(d => ({ ...d, [m.id]: t }))} onSend={() => handleReply(m)} sending={replyingId === m.id}
                      onClose={() => handleStaffClose(m)}
                      header={<TemplateChips templates={tpl.templates} onPick={t => { setReplyDrafts(d => ({ ...d, [m.id]: fillTemplate(t.body, m.userName, d[m.id], templateFallback(language === 'tr' ? 'tr' : 'en')) })); }} />}
                    />

                    {!m.isRead && (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: S.xxs }}>
                        <Touchable
                          onPress={() => handleMarkRead(m)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, paddingHorizontal: S.sm, paddingVertical: S.sm, borderRadius: R.md }}
                        >
                          <Check size={ICON.sm} color="#10B981" />
                          <Text style={{ color: '#10B981', fontSize: F.caption, fontWeight: '700' }}>{tr ? 'Okundu Yap' : 'Mark Read'}</Text>
                        </Touchable>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          ) : activeTab === 'system' ? (
            /* ── SİSTEM KONSOLU ── */
            <View style={{ gap: S.md }}>
              <JobHealthCard lang={tr ? 'tr' : 'en'} />
              {/* Denetim günlüğü (audit log) */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    <View style={{ width: 28, height: 28, borderRadius: R.sm, backgroundColor: '#6366F120', alignItems: 'center', justifyContent: 'center' }}>
                      <ScrollText size={ICON.sm} color="#6366F1" />
                    </View>
                    <View>
                      <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Denetim Günlüğü' : 'Audit Log'}</Text>
                      <Text style={{ color: theme.onSurfaceMuted, fontSize: 10 }}>{tr ? 'admin aksiyonları' : 'admin actions'}</Text>
                    </View>
                  </View>
                  <Touchable accessibilityRole="button" accessibilityLabel={tr ? 'Denetim kaydını yenile' : 'Refresh audit log'} accessibilityState={{ busy: auditLoading }} onPress={loadAudit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    {auditLoading ? <ActivityIndicator size="small" color={theme.primary} /> : <RefreshCw size={ICON.sm} color={theme.primary} />}
                  </Touchable>
                </View>
                {auditLogs.length === 0 ? (
                  <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{tr ? 'Kayıt yok' : 'No records'}</Text>
                ) : (
                  <View>
                    {/* `.slice(0, 40)` KALDIRILDI: sunucu artik sayfaliyor. Once 100
                        kayit cekilip 40'i ciziliyordu — 60'i aga gidip cope atiliyordu. */}
                    {auditLogs.map((a, i) => {
                      const actionMeta: Record<string, { c: string; l: string }> = {
                        ban: { c: theme.error, l: 'BAN' },
                        unban: { c: '#10B981', l: tr ? 'KALDIR' : 'UNBAN' },
                        delete_user: { c: theme.error, l: tr ? 'SİL' : 'DELETE' },
                        role_change: { c: '#6366F1', l: tr ? 'ROL' : 'ROLE' },
                        maintenance: { c: '#F59E0B', l: tr ? 'BAKIM' : 'MAINT' },
                        export: { c: '#06B6D4', l: 'EXPORT' },
                      };
                      const meta = actionMeta[a.action] || { c: theme.onSurfaceVariant, l: a.action.toUpperCase() };
                      return (
                        <View key={a.id} style={{ flexDirection: 'row', gap: S.sm, paddingVertical: S.sm, borderTopWidth: i > 0 ? B.thin : 0, borderTopColor: cardBorder }}>
                          <View style={{ backgroundColor: meta.c + '1A', borderRadius: R.xs, paddingHorizontal: S.xs, paddingVertical: S.xxs, alignSelf: 'flex-start', marginTop: S.xxs }}>
                            <Text style={{ color: meta.c, fontSize: F.caption, fontWeight: '700' }}>{meta.l}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={2} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600', lineHeight: 15 }}>
                              {a.targetName ? `${a.targetName} — ` : ''}{a.details || '—'}
                            </Text>
                            <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>
                              {a.adminName || '—'} · {new Date(a.createdAt).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                <Pager
                  page={auditPage}
                  pageSize={AUDIT_PAGE_SIZE}
                  total={auditMeta.total}
                  hasMore={auditMeta.hasMore}
                  onChange={setAuditPage}
                  tr={tr}
                />
              </View>

              {/* Sağlık kartı */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    <View style={{ width: 9, height: 9, borderRadius: R.full, backgroundColor: sysHealth ? (sysHealth.dbOk ? '#10B981' : '#EF4444') : theme.onSurfaceVariant }} />
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Sistem Sağlığı' : 'System Health'}</Text>
                  </View>
                  <Touchable onPress={loadSystem} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    {sysLoading ? <ActivityIndicator size="small" color={theme.primary} /> : <RefreshCw size={ICON.sm} color={theme.primary} />}
                    <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '700' }}>{tr ? 'Yenile' : 'Refresh'}</Text>
                  </Touchable>
                </View>
                {sysHealth ? (
                  <View style={{ gap: S.xs }}>
                    {[
                      [tr ? 'Veritabanı' : 'Database', sysHealth.dbOk ? 'OK' : 'Hata'],
                      [tr ? 'Redis' : 'Redis', sysHealth.redisOk == null ? '—' : (sysHealth.redisOk ? 'OK' : 'Hata')],
                      [tr ? 'Çalışma süresi' : 'Uptime', `${Math.floor(sysHealth.uptimeSeconds / 3600)}s ${Math.floor((sysHealth.uptimeSeconds % 3600) / 60)}d`],
                      [tr ? 'Ortam' : 'Env', sysHealth.environment],
                      [tr ? 'Son migration' : 'Latest migration', (sysHealth.latestMigration || '—').replace(/^\d+_/, '')],
                      [tr ? 'Bekleyen migration' : 'Pending migrations', String(sysHealth.pendingMigrations)],
                      [tr ? 'Uyarı / Hata' : 'Warnings / Errors', `${sysHealth.warnings} / ${sysHealth.errors}`],
                    ].map(([k, v], i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption }}>{k}</Text>
                        <Text style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '700' }}>{v}</Text>
                      </View>
                    ))}
                  </View>
                ) : sysLoading ? <ActivityIndicator color={theme.primary} /> : <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{tr ? 'Veri yok' : 'No data'}</Text>}
              </View>

              {/* Bakım aksiyonları */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Bakım' : 'Maintenance'}</Text>
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  {[
                    { key: 'migrate', icon: <Database size={ICON.sm} color="#3B82F6" />, label: tr ? 'Migration' : 'Migrate', color: '#3B82F6',
                      run: () => runMaintenance('migrate', AdminSystemService.migrate, tr ? 'Migration uygula?' : 'Apply migrations?', tr ? 'Bekleyen veritabanı migration’ları uygulanacak.' : 'Pending DB migrations will be applied.') },
                    { key: 'cache', icon: <Trash2 size={ICON.sm} color="#F59E0B" />, label: tr ? 'Cache' : 'Cache', color: '#F59E0B',
                      run: () => runMaintenance('cache', AdminSystemService.clearCache, tr ? 'Cache temizle?' : 'Clear cache?', tr ? 'Redis önbelleği temizlenecek.' : 'Redis cache will be cleared.') },
                    { key: 'restart', icon: <Power size={ICON.sm} color="#EF4444" />, label: tr ? 'Restart' : 'Restart', color: '#EF4444',
                      run: () => runMaintenance('restart', AdminSystemService.restart, tr ? 'Backend yeniden başlatılsın mı?' : 'Restart backend?', tr ? 'Birkaç saniyelik kesinti olur.' : 'Brief downtime (a few seconds).') },
                  ].map((a) => (
                    <Touchable key={a.key} onPress={a.run} disabled={!!sysBusy}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, backgroundColor: a.color + '15', borderWidth: B.thin, borderColor: a.color + '40', borderRadius: R.md, paddingVertical: S.sm }}>
                      {sysBusy === a.key ? <ActivityIndicator size="small" color={a.color} /> : a.icon}
                      <Text style={{ color: a.color, fontSize: F.caption, fontWeight: '700' }}>{a.label}</Text>
                    </Touchable>
                  ))}
                </View>
              </View>

              {/* Sentry — son 24s çözülmemiş konular */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    <View style={{ width: 28, height: 28, borderRadius: R.sm, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={ICON.sm} color="#8B5CF6" />
                    </View>
                    <View>
                      <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>Sentry</Text>
                      <Text style={{ color: theme.onSurfaceMuted, fontSize: 10 }}>{tr ? 'son 24 saat' : 'last 24h'}</Text>
                    </View>
                  </View>
                  {sysSentry?.dashboard && (
                    <Touchable onPress={() => Linking.openURL(sysSentry.dashboard!)} style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: theme.primary + '15', paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full }}>
                      <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '700' }}>{tr ? 'Panele git' : 'Open'}</Text>
                      <ExternalLink size={ICON.xs} color={theme.primary} />
                    </Touchable>
                  )}
                </View>
                {!sysSentry ? (
                  <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{tr ? 'Yükleniyor…' : 'Loading…'}</Text>
                ) : !sysSentry.configured ? (
                  <View style={{ backgroundColor: theme.surfaceContainerHigh, borderRadius: R.md, padding: S.sm }}>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, lineHeight: 17 }}>{sysSentry.message || (tr ? 'Sentry yapılandırılmamış.' : 'Sentry not configured.')}</Text>
                  </View>
                ) : sysSentry.ok === false ? (
                  <Text style={{ color: theme.error, fontSize: F.caption, fontWeight: '600' }}>{tr ? 'Sentry’ye ulaşılamadı.' : 'Could not reach Sentry.'} {sysSentry.status ? `(HTTP ${sysSentry.status})` : ''}</Text>
                ) : (sysSentry.issues && sysSentry.issues.length > 0) ? (
                  <>
                    {(() => {
                      const fatals = sysSentry.issues!.filter(x => (x.level || '').toLowerCase() === 'fatal').length;
                      const errs = sysSentry.issues!.filter(x => (x.level || '').toLowerCase() === 'error').length;
                      return (
                        <View style={{ flexDirection: 'row', gap: S.xs }}>
                          {fatals > 0 && <View style={{ backgroundColor: '#DC262615', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xs }}><Text style={{ color: '#DC2626', fontSize: 10, fontWeight: '700' }}>{fatals} FATAL</Text></View>}
                          {errs > 0 && <View style={{ backgroundColor: '#EF444415', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xs }}><Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}>{errs} ERROR</Text></View>}
                          <View style={{ backgroundColor: theme.surfaceContainerHigh, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: S.xs }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 10, fontWeight: '700' }}>{sysSentry.issues!.length} {tr ? 'konu' : 'issues'}</Text></View>
                        </View>
                      );
                    })()}
                    <View>
                      {sysSentry.issues!.slice(0, 6).map((iss, i) => {
                        const st = sentryLevelStyle(iss.level);
                        return (
                          <Touchable key={i} onPress={() => iss.permalink && Linking.openURL(iss.permalink)}
                            style={{ flexDirection: 'row', gap: S.sm, paddingVertical: S.sm, borderTopWidth: i > 0 ? B.thin : 0, borderTopColor: cardBorder }}>
                            <View style={{ backgroundColor: st.color + '1A', borderRadius: R.sm, paddingHorizontal: S.sm, paddingVertical: S.xxs, alignSelf: 'flex-start', marginTop: S.xxs }}>
                              <Text style={{ color: st.color, fontSize: F.caption, fontWeight: '700' }}>{st.label}</Text>
                            </View>
                            <View style={{ flex: 1, gap: S.xs }}>
                              <Text numberOfLines={2} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '700', lineHeight: 16 }}>{iss.title}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                                <Text style={{ color: st.color, fontSize: 10, fontWeight: '700' }}>×{iss.count || '1'}</Text>
                                {iss.lastSeen && <Text style={{ color: theme.onSurfaceMuted, fontSize: 10 }}>· {timeAgo(iss.lastSeen, tr)}</Text>}
                              </View>
                            </View>
                            <ExternalLink size={ICON.xs} color={theme.onSurfaceVariant} style={{ opacity: 0.35, marginTop: S.xxs }} />
                          </Touchable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: '#10B98112', borderRadius: R.md, padding: S.sm }}>
                    <Check size={ICON.sm} color="#10B981" />
                    <Text style={{ color: '#10B981', fontSize: F.caption, fontWeight: '700' }}>{tr ? 'Son 24 saatte çözülmemiş hata yok' : 'No unresolved issues (24h)'}</Text>
                  </View>
                )}
              </View>

              {/* Çökmeler — hata başına tek satır + saklama süresi (bkz. CrashGroupsCard, sunucu CrashLog). */}
              <CrashGroupsCard lang={tr ? 'tr' : 'en'} />

              {/* Loglar */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    <View style={{ width: 28, height: 28, borderRadius: R.sm, backgroundColor: theme.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={ICON.sm} color={theme.onSurfaceVariant} />
                    </View>
                    <View>
                      <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Loglar' : 'Logs'}</Text>
                      {/* Toplam değil CANLI sayaç: geliştirme gürültüsü rozeti sürekli
                          kırmızı tutuyordu ve sürekli kırmızı olan gösterge okunmaz. */}
                      {sysHealth && (
                        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>
                          {sysLogMeta.total} {tr ? 'kayıt' : 'records'}
                          {sysLogSource === 'Production' ? (tr ? ' · canlı' : ' · live') : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: S.xs }}>
                    {[null, 'Warning', 'Error'].map((lv) => (
                      <Touchable key={lv || 'all'} onPress={() => setSysLogLevel(lv)}
                        style={{ paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: sysLogLevel === lv ? theme.primary : theme.surfaceContainerHigh }}>
                        <Text style={{ color: sysLogLevel === lv ? '#FFF' : theme.onSurfaceVariant, fontSize: 10, fontWeight: '700' }}>{lv ? (lv === 'Warning' ? (tr ? 'Uyarı' : 'Warn') : (tr ? 'Hata' : 'Err')) : (tr ? 'Hepsi' : 'All')}</Text>
                      </Touchable>
                    ))}
                  </View>
                </View>

                {/*
                  KAYNAK FİLTRESİ. Geliştirme sürümü de canlı API'ye bağlandığı için kod
                  yazarken çıkan hatalar aynı havuza düşüyor. Varsayılan "Canlı": panelin
                  cevaplaması gereken ilk soru "gerçek kullanıcıda ne kırıldı?".
                  Kayıtlar silinmiyor — tek dokunuşla geri geliyor.
                */}
                <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
                  {([['Production', tr ? 'Canlı' : 'Live'], ['Development', tr ? 'Geliştirme' : 'Dev'], [null, tr ? 'Tümü' : 'All']] as const).map(([src, label]) => {
                    const active = sysLogSource === src;
                    const n = src ? (sysLogMeta.counts[src as LogSource] ?? 0) : Object.values(sysLogMeta.counts).reduce((a, b) => a + (b ?? 0), 0);
                    return (
                      <Touchable key={label} onPress={() => setSysLogSource(src as LogSource | null)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: S.xxs, paddingHorizontal: S.sm, paddingVertical: S.xs, borderRadius: R.full, backgroundColor: active ? theme.primary : theme.surfaceContainerHigh }}>
                        <Text style={{ color: active ? '#FFF' : theme.onSurfaceVariant, fontSize: F.caption, fontWeight: '700' }}>{label}</Text>
                        {/* Sayı filtreye BASMADAN "burada ne var?" sorusunu cevaplıyor. */}
                        <Text style={{ color: active ? '#FFF' : theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '600' }}>{n}</Text>
                      </Touchable>
                    );
                  })}
                </View>

                {sysLogs.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: S.md }}>
                    <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{tr ? 'Kayıt yok' : 'No logs'}</Text>
                  </View>
                ) : (
                  <View>
                    {/* `.slice(0, 60)` KALDIRILDI: sunucu artık sayfalıyor, istemcinin
                        ikinci kez kırpması kayıtları görünmez yapıyordu. */}
                    {sysLogs.map((lg, i) => {
                      const st = logLevelStyle(lg.level);
                      return (
                        <View key={i} style={{ gap: S.xs, borderTopWidth: i > 0 ? B.thin : 0, borderTopColor: cardBorder, paddingVertical: S.sm }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
                            <View style={{ backgroundColor: st.color + '1A', borderRadius: R.xs, paddingHorizontal: S.xs, paddingVertical: S.xxs }}>
                              <Text style={{ color: st.color, fontSize: F.caption, fontWeight: '700' }}>{st.label}</Text>
                            </View>
                            <Text numberOfLines={1} style={{ color: theme.onSurfaceVariant, fontSize: 10, fontWeight: '700', flex: 1 }}>{lg.category}</Text>
                            {/* Kaynak rozeti YALNIZ karışık listede: tek kaynağa
                                filtrelenmişken her satıra aynı etiketi basmak gürültü. */}
                            {!sysLogSource && lg.source === 'Development' && (
                              <View style={{ backgroundColor: theme.onSurfaceMuted + '1A', borderRadius: R.xs, paddingHorizontal: S.xs }}>
                                <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption, fontWeight: '700' }}>{tr ? 'DEV' : 'DEV'}</Text>
                              </View>
                            )}
                            <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{new Date(lg.timestamp).toLocaleTimeString(tr ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                          </View>
                          <Text numberOfLines={3} style={{ color: theme.onSurface, fontSize: F.caption, lineHeight: 16 }}>{lg.message}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <Pager
                  page={sysLogPage}
                  pageSize={LOG_PAGE_SIZE}
                  total={sysLogMeta.total}
                  hasMore={sysLogMeta.hasMore}
                  onChange={setSysLogPage}
                  tr={tr}
                />
              </View>

              {/*
                YAPAY ZEKA. Buraya kadar AI'in calisip calismadigini anlamanin tek yolu
                sunucuya SSH ile girip .env okumak ya da uygulamada plan acip logda hata
                aramakti — ikisi de "once kirilsin, sonra fark edeyim" yontemi.

                Anahtar MASKELI gosteriliyor: panelden okunabilen bir sir artik sir
                degildir. Dogrulamak icin gormeye gerek yok — test dugmesi saglayiciya
                canli istek atiyor, cunku "tanimli" ile "calisiyor" farkli seyler
                (anahtar iptal edilmis, kota dolmus ya da model listeden kalkmis olabilir).
              */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                  <View style={{ width: 28, height: 28, borderRadius: R.sm, backgroundColor: theme.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={ICON.sm} color={aiStatus?.configured ? theme.primary : theme.onSurfaceVariant} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Yapay Zeka' : 'AI'}</Text>
                    <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>
                      {aiStatus
                        ? (aiStatus.configured
                            ? aiStatus.keyMasked + ' - ' + aiStatus.keyLength + (tr ? ' karakter' : ' chars')
                            : (tr ? 'Anahtar tanimli degil' : 'No API key'))
                        : (tr ? 'Yukleniyor...' : 'Loading...')}
                    </Text>
                  </View>
                </View>

                {aiStatus && (
                  <View style={{ gap: S.xxs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>Model</Text>
                      <Text style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }}>{aiStatus.model}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{tr ? 'Kaynak' : 'Source'}</Text>
                      <Text style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '600' }}>
                        {aiStatus.modelFromEnv ? 'GROQ_MODEL' : (tr ? 'varsayilan' : 'default')}
                      </Text>
                    </View>
                  </View>
                )}

                <Touchable
                  disabled={aiTesting}
                  onPress={async () => {
                    setAiTesting(true);
                    // Basma anında titreşim YOK: düğme zaten soluklaşıyor ve yazısı
                    // "Deneniyor…"e dönüyor. Görülebilen bir şeyi ayrıca titretmek,
                    // titreşimi bilgi taşımaktan çıkarıp gürültüye çevirir. Titreşimi
                    // SONUCA sakladık — tahmin edilemeyen kısım o.
                    try {
                      const r = await AdminSystemService.aiTest();
                      setAiTest(r);
                      if (r.ok) { haptic.success(); } else { haptic.error(); }
                    } catch {
                      setAiTest({ ok: false, stage: 'network', message: tr ? 'Istek basarisiz' : 'Request failed' });
                      haptic.error();
                    } finally {
                      setAiTesting(false);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={tr ? 'Yapay zeka baglantisini test et' : 'Test AI connection'}
                  style={{ alignItems: 'center', paddingVertical: S.sm, borderRadius: R.md, backgroundColor: theme.surfaceContainerHigh, opacity: aiTesting ? 0.6 : 1 }}
                >
                  <Text style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '700' }}>
                    {aiTesting ? (tr ? 'Deneniyor...' : 'Testing...') : (tr ? 'Baglantiyi Test Et' : 'Test Connection')}
                  </Text>
                </Touchable>

                {aiTest && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: S.xs, backgroundColor: (aiTest.ok ? theme.tertiary : theme.warning) + '14', borderRadius: R.sm, padding: S.sm }}>
                    {aiTest.ok
                      ? <CheckCircle2 size={ICON.sm} color={theme.tertiary} />
                      : <AlertTriangle size={ICON.sm} color={theme.warning} />}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: aiTest.ok ? theme.tertiary : theme.warning, fontSize: F.caption, fontWeight: '700' }}>
                        {aiTest.message}
                      </Text>
                      {/* Gecikme de bilgi: 200ms ile 9sn arasindaki fark, kullanicinin
                          "takildi mi?" diye sorup sormayacagini belirler. */}
                      {aiTest.ok && aiTest.latencyMs != null && (
                        <Text style={{ color: theme.onSurfaceMuted, fontSize: F.caption }}>{aiTest.latencyMs} ms</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Yazarak onaylı hard-delete modalı */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => { if (!deleting) setDeleteTarget(null); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: S.lg }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => { if (!deleting) { Keyboard.dismiss(); setDeleteTarget(null); } }} />
          <MotiView from={{ opacity: 0, scale: 0.96, translateY: 12 }} animate={{ opacity: 1, scale: 1, translateY: 0 }} transition={{ type: 'spring', damping: 18 }}
            style={{ width: '100%', maxWidth: 420, borderRadius: R.sheet, padding: S.lg, gap: S.md }}>
            <GlassSurface radius={R.sheet} />
            <View style={{ width: 52, height: 52, borderRadius: R.full, backgroundColor: theme.error + '18', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
              <Trash2 size={ICON.lg} color={theme.error} strokeWidth={2.2} />
            </View>
            <Text style={{ fontSize: F.subhead, fontWeight: '700', color: theme.onSurface, textAlign: 'center' }}>
              {tr ? 'Kalıcı Olarak Sil' : 'Permanently Delete'}
            </Text>
            <Text style={{ fontSize: F.caption + 1, color: theme.onSurfaceVariant, textAlign: 'center', lineHeight: 19 }}>
              {tr
                ? `${deleteTarget?.name} ve TÜM verileri (görevler, seanslar, oturumlar) geri alınamaz şekilde silinecek. Onaylamak için "${DELETE_WORD}" yaz.`
                : `${deleteTarget?.name} and ALL their data (tasks, sessions, sessions) will be irreversibly deleted. Type "${DELETE_WORD}" to confirm.`}
            </Text>
            <TextInput
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={DELETE_WORD}
              placeholderTextColor={theme.onSurfaceVariant + '70'}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
              style={{ borderWidth: B.medium, borderColor: theme.outline, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm, color: theme.onSurface, fontSize: F.body, fontWeight: '700', textAlign: 'center', letterSpacing: 2 }}
            />
            <View style={{ flexDirection: 'row', gap: S.sm }}>
              <Touchable onPress={() => { if (!deleting) { Keyboard.dismiss(); setDeleteTarget(null); } }} style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', alignItems: 'center' }}>
                <Text style={{ color: theme.onSurface, fontWeight: '700', fontSize: F.body }}>{tr ? 'Vazgeç' : 'Cancel'}</Text>
              </Touchable>
              <Touchable
                onPress={performTypedDelete}
                disabled={deleting || deleteConfirmText.trim().toLocaleUpperCase(tr ? 'tr-TR' : 'en-US') !== DELETE_WORD}
                style={{ flex: 1, paddingVertical: S.md, borderRadius: R.md, backgroundColor: theme.error, alignItems: 'center', justifyContent: 'center', opacity: (deleting || deleteConfirmText.trim().toLocaleUpperCase(tr ? 'tr-TR' : 'en-US') !== DELETE_WORD) ? 0.5 : 1 }}
              >
                {deleting ? <ActivityIndicator size="small" color={theme.onError} /> : <Text style={{ color: theme.onError, fontWeight: '700', fontSize: F.body }}>{tr ? 'Kalıcı Sil' : 'Delete'}</Text>}
              </Touchable>
            </View>
          </MotiView>
        </View>
        <AlertHost />{/* modal içinden açılan uyarı burada, modalın üstünde (bkz. CustomAlert) */}
      </Modal>
      {/* Rol seçici sayfa düzeyinde — bir modalın İÇİNDE olunca o modal kapalıyken hiç çizilmiyordu. */}
      <RolePicker visible={!!rolePickFor} name={rolePickFor?.name ?? ''} current={rolePickFor?.role ?? 'User'} lang={tr ? 'tr' : 'en'} onPick={r => rolePickFor && applyRole(rolePickFor, r)} onClose={() => setRolePickFor(null)} />
    </SafeAreaView>
  );
}
export { RouteErrorBoundary as ErrorBoundary } from '@/shared/components/CrashFallback'; // çökerse yalnız bu ekran düşer
