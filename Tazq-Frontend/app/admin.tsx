import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Users, CheckSquare, Clock, Trash2, Shield, ShieldOff,
  Search, TrendingUp, Zap, Activity, ChevronDown, ChevronUp, Ban, MessageSquare, Check, Mail, Send, CornerDownRight,
  Server, RefreshCw, Power, Database, AlertTriangle, FileText, ExternalLink, BarChart3
} from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAuthStore } from '../store/useAuthStore';
import { AdminService, AdminUser, AdminStats, SupportService, SupportMessageItem, AdminSystemService, SystemHealth, SystemStats, SystemLogEntry, SentrySummary } from '../services/api';
import { sendAdminSupportNotification } from '../utils/notifications';
import { S, R, F, B, MAX_W } from '../constants/tokens';
import * as Haptics from 'expo-haptics';
import { Touchable } from '@/components/Touchable';
import { CustomAlert as Alert } from '../components/CustomAlert';

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

export default function AdminScreen() {
  const { theme, colorScheme } = useAppTheme();
  const { language } = useLanguageStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const tr = language === 'tr';
  const myId = useAuthStore(s => s.user?.id);

  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'support' | 'system'>('users');
  const [sysHealth, setSysHealth] = useState<SystemHealth | null>(null);
  const [sysStats, setSysStats] = useState<SystemStats | null>(null);
  const [sysLogs, setSysLogs] = useState<SystemLogEntry[]>([]);
  const [sysSentry, setSysSentry] = useState<SentrySummary | null>(null);
  const [sysLogLevel, setSysLogLevel] = useState<string | null>(null);
  const [sysLoading, setSysLoading] = useState(false);
  const [sysBusy, setSysBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessageItem[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [expandedMsgs, setExpandedMsgs] = useState<Record<number, boolean>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const [s, u, m] = await Promise.all([
        AdminService.getStats(),
        AdminService.getUsers(),
        SupportService.getAllMessages().catch(() => ({ messages: [], unreadCount: 0 })),
      ]);
      setStats(s);
      setUsers(u);
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
  }, [tr]);

  const handleMarkRead = async (msg: SupportMessageItem) => {
    Haptics.selectionAsync();
    try {
      await SupportService.markAsRead(msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isRead: true } : m));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const performDeleteMessage = async (msg: SupportMessageItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await SupportService.replyMessage(msg.id, text);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, adminReply: text, repliedAt: new Date().toISOString(), isRead: true } : m));
      if (!msg.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
      setReplyDrafts(d => ({ ...d, [msg.id]: '' }));
    } catch {
      Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Yanıt gönderilemedi. Lütfen tekrar dene.' : 'Could not send reply. Please try again.');
    } finally {
      setReplyingId(null);
    }
  };

  useEffect(() => { load(); }, [load]);

  // ── Sistem konsolu ──────────────────────────────────────────────────────────
  const loadSystem = useCallback(async () => {
    setSysLoading(true);
    try {
      const [h, s, l, se] = await Promise.all([
        AdminSystemService.health().catch(() => null),
        AdminSystemService.stats().catch(() => null),
        AdminSystemService.logs(200, sysLogLevel || undefined).catch(() => ({ logs: [] as SystemLogEntry[] })),
        AdminSystemService.sentry().catch(() => null),
      ]);
      setSysHealth(h);
      setSysStats(s);
      setSysLogs(l.logs || []);
      setSysSentry(se);
    } finally {
      setSysLoading(false);
    }
  }, [sysLogLevel]);

  useEffect(() => { if (activeTab === 'system') loadSystem(); }, [activeTab, loadSystem]);

  const runMaintenance = (key: string, fn: () => Promise<any>, title: string, body: string) => {
    Alert.alert(title, body, [
      { text: tr ? 'Vazgeç' : 'Cancel', style: 'cancel' },
      {
        text: tr ? 'Devam' : 'Proceed', style: 'destructive', onPress: async () => {
          setSysBusy(key);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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

  const filteredUsers = useMemo(() => {
    let list = [...users];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'name')   diff = a.name.localeCompare(b.name);
      if (sortKey === 'tasks')  diff = a.taskCount - b.taskCount;
      if (sortKey === 'focus')  diff = a.focusMinutes - b.focusMinutes;
      if (sortKey === 'recent') {
        const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        diff = ta - tb;
      }
      return sortAsc ? diff : -diff;
    });
    return list;
  }, [users, search, sortKey, sortAsc]);

  const handleDelete = (user: AdminUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      tr ? 'Kullanıcıyı Sil' : 'Delete User',
      tr ? `${user.name} kalıcı olarak silinecek. Tüm verileri de silinir.` : `${user.name} will be permanently deleted with all their data.`,
      [
        { text: tr ? 'İptal' : 'Cancel', style: 'cancel' },
        { text: tr ? 'Sil' : 'Delete', style: 'destructive', onPress: async () => {
          try {
            await AdminService.deleteUser(user.id);
            setUsers(prev => prev.filter(u => u.id !== user.id));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Silinemedi.' : 'Could not delete.');
          }
        }},
      ]
    );
  };

  const handleToggleRole = (user: AdminUser) => {
    const newRole = user.role === 'Admin' ? 'User' : 'Admin';
    Haptics.selectionAsync();
    Alert.alert(
      tr ? 'Rol Değiştir' : 'Change Role',
      tr ? `${user.name} → ${newRole} yapılsın mı?` : `Promote ${user.name} to ${newRole}?`,
      [
        { text: tr ? 'İptal' : 'Cancel', style: 'cancel' },
        { text: tr ? 'Onayla' : 'Confirm', onPress: async () => {
          try {
            await AdminService.setRole(user.id, newRole);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
          } catch {
            Alert.alert(tr ? 'Hata' : 'Error', tr ? 'Değiştirilemedi.' : 'Could not update.');
          }
        }},
      ]
    );
  };

  const handleToggleBan = (user: AdminUser) => {
    const willBan = !user.isBanned;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      willBan ? (tr ? 'Kullanıcıyı Banla' : 'Ban User') : (tr ? 'Banı Kaldır' : 'Unban User'),
      willBan
        ? (tr ? `${user.name} giriş yapamayacak ve oturumu kapatılacak.` : `${user.name} will be unable to log in and will be signed out.`)
        : (tr ? `${user.name} tekrar giriş yapabilecek.` : `${user.name} will be able to log in again.`),
      [
        { text: tr ? 'İptal' : 'Cancel', style: 'cancel' },
        { text: willBan ? (tr ? 'Banla' : 'Ban') : (tr ? 'Banı Kaldır' : 'Unban'), style: willBan ? 'destructive' : 'default', onPress: async () => {
          try {
            await AdminService.setBan(user.id, willBan);
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isBanned: willBan } : u));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    Haptics.selectionAsync();
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
  const maxBar     = stats?.dailyTrend ? Math.max(...stats.dailyTrend.map(d => d.minutes), 1) : 1;

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k;
    return (
      <Touchable
        onPress={() => cycleSort(k)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: S.sm, paddingVertical: 5, borderRadius: R.full, backgroundColor: active ? theme.primary + '20' : cardBg, borderWidth: B.thin, borderColor: active ? theme.primary + '40' : cardBorder }}
      >
        <Text style={{ fontSize: F.caption, fontWeight: '700', color: active ? theme.primary : theme.onSurfaceVariant }}>{label}</Text>
        {active && (sortAsc ? <ChevronUp size={10} color={theme.primary} /> : <ChevronDown size={10} color={theme.primary} />)}
      </Touchable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: S.md, paddingTop: S.sm, paddingBottom: S.md, gap: S.sm }}>
        <Touchable onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: cardBg, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={20} color={theme.onSurface} />
        </Touchable>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flex: 1, fontSize: F.title, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}>
          {tr ? 'Admin Paneli' : 'Admin Panel'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: '#6366F115', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 4 }}>
          <Shield size={12} color="#6366F1" />
          <Text style={{ fontSize: F.caption, fontWeight: '800', color: '#6366F1' }}>ADMIN</Text>
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
            <Text style={{ color: theme.primary, fontWeight: '800' }}>{tr ? 'Tekrar Dene' : 'Retry'}</Text>
          </Touchable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: insets.bottom + S.xl, gap: S.md, width: '100%', maxWidth: MAX_W, alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={theme.surface} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Tab Switcher (4 sekme) */}
          <View style={{ flexDirection: 'row', backgroundColor: cardBg, borderRadius: R.full, padding: 4, borderWidth: B.thin, borderColor: cardBorder }}>
            {([
              { key: 'users', icon: Users, label: tr ? 'Kullanıcı' : 'Users' },
              { key: 'stats', icon: BarChart3, label: tr ? 'İstatistik' : 'Stats' },
              { key: 'support', icon: MessageSquare, label: tr ? 'Destek' : 'Support', badge: unreadCount },
              { key: 'system', icon: Server, label: tr ? 'Sistem' : 'System', dot: !!sysHealth && (sysHealth.errors > 0 || !sysHealth.dbOk) },
            ] as const).map((tb) => {
              const active = activeTab === tb.key;
              const Icon = tb.icon;
              return (
                <Touchable key={tb.key} onPress={() => { Haptics.selectionAsync(); setActiveTab(tb.key as any); }}
                  style={{ flex: 1, paddingVertical: S.sm, borderRadius: R.full, backgroundColor: active ? theme.primary : 'transparent', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
                  <Icon size={14} color={active ? '#FFF' : theme.onSurfaceVariant} />
                  <Text numberOfLines={1} style={{ color: active ? '#FFF' : theme.onSurfaceVariant, fontWeight: '800', fontSize: 11 }}>{tb.label}</Text>
                  {'badge' in tb && (tb as any).badge > 0 && (
                    <View style={{ backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                      <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '900' }}>{(tb as any).badge}</Text>
                    </View>
                  )}
                  {'dot' in tb && (tb as any).dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />}
                </Touchable>
              );
            })}
          </View>

          {/* ── İSTATİSTİK sekmesi: genel bakış ── */}
          {activeTab === 'stats' && stats && (
            <>
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {[
                  { icon: <Users size={16} color="#6366F1" />, label: tr ? 'Kullanıcı' : 'Users', value: stats.totalUsers, color: '#6366F1' },
                  { icon: <Activity size={16} color="#10B981" />, label: tr ? 'Bugün Aktif' : 'Active Today', value: stats.activeToday, color: '#10B981' },
                  { icon: <TrendingUp size={16} color="#F59E0B" />, label: tr ? 'Bu Hafta' : 'This Week', value: stats.activeThisWeek, color: '#F59E0B' },
                ].map(c => (
                  <MotiView key={c.label} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 350 }}
                    style={{ flex: 1, backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: cardBorder, padding: S.sm + 2, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c.color + '20', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</View>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}>{c.value}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant, textAlign: 'center' }}>{c.label}</Text>
                  </MotiView>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {[
                  { icon: <CheckSquare size={16} color="#8B5CF6" />, label: tr ? 'Toplam Görev' : 'Total Tasks', value: stats.totalTasks, color: '#8B5CF6' },
                  { icon: <CheckSquare size={16} color="#06B6D4" />, label: tr ? 'Tamamlanan' : 'Completed', value: stats.completedTasks, color: '#06B6D4' },
                  { icon: <Clock size={16} color="#F43F5E" />, label: tr ? 'Odak (saat)' : 'Focus (hrs)', value: Math.round(stats.totalFocusMinutes / 60), color: '#F43F5E' },
                ].map(c => (
                  <MotiView key={c.label} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 400 }}
                    style={{ flex: 1, backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: cardBorder, padding: S.sm + 2, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c.color + '20', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</View>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}>{c.value}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant, textAlign: 'center' }}>{c.label}</Text>
                  </MotiView>
                ))}
              </View>

              {/* ── Destek (Sistem'den taşındı) ── */}
              <View style={{ flexDirection: 'row', gap: S.sm }}>
                {[
                  { icon: <MessageSquare size={16} color="#3B82F6" />, label: tr ? 'Destek Mesajı' : 'Support', value: messages.length, color: '#3B82F6' },
                  { icon: <Mail size={16} color="#EF4444" />, label: tr ? 'Okunmamış' : 'Unread', value: unreadCount, color: '#EF4444' },
                ].map(c => (
                  <MotiView key={c.label} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 450 }}
                    style={{ flex: 1, backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: cardBorder, padding: S.sm + 2, alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c.color + '20', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</View>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: theme.onSurface, letterSpacing: -0.5 }}>{c.value}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant, textAlign: 'center' }}>{c.label}</Text>
                  </MotiView>
                ))}
              </View>

              {/* ── Completion rate bar ── */}
              {stats.totalTasks > 0 && (
                <View style={{ backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: cardBorder, padding: S.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: S.sm }}>
                    <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant }}>{tr ? 'TAMAMLANMA ORANI' : 'COMPLETION RATE'}</Text>
                    <Text style={{ fontSize: F.caption, fontWeight: '900', color: '#10B981' }}>
                      {Math.round((stats.completedTasks / stats.totalTasks) * 100)}%
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', borderRadius: R.full, overflow: 'hidden' }}>
                    <MotiView
                      from={{ width: '0%' }}
                      animate={{ width: `${Math.round((stats.completedTasks / stats.totalTasks) * 100)}%` as any }}
                      transition={{ type: 'timing', duration: 800, delay: 200 }}
                      style={{ height: '100%', backgroundColor: '#10B981', borderRadius: R.full }}
                    />
                  </View>
                </View>
              )}

              {/* ── 7-day focus trend ── */}
              {stats.dailyTrend && (
                <View style={{ backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: cardBorder, padding: S.md }}>
                  <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, marginBottom: S.md }}>
                    {tr ? '7 GÜNLÜK ODAK TRENDİ' : '7-DAY FOCUS TREND'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xs, height: 60 }}>
                    {stats.dailyTrend.map((d, i) => (
                      <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                        <MotiView
                          from={{ height: 2 }}
                          animate={{ height: Math.max(4, (d.minutes / maxBar) * 48) }}
                          transition={{ type: 'timing', duration: 600, delay: i * 60 }}
                          style={{ width: '100%', backgroundColor: d.minutes > 0 ? theme.primary : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), borderRadius: 3 }}
                        />
                        <Text style={{ fontSize: 9, fontWeight: '600', color: theme.onSurfaceVariant, opacity: 0.6 }}>{d.day}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {activeTab === 'users' ? (
            <>
              {/* ── Search + Sort ── */}
              <View style={{ gap: S.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: cardBorder, paddingHorizontal: S.sm, paddingVertical: S.xs }}>
              <Search size={16} color={theme.onSurfaceVariant} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={tr ? 'İsim veya e-posta ara…' : 'Search name or email…'}
                placeholderTextColor={theme.onSurfaceVariant + '60'}
                style={{ flex: 1, fontSize: F.body, color: theme.onSurface, paddingVertical: 4 }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: S.xs, flexWrap: 'wrap' }}>
              <SortBtn k="recent" label={tr ? 'Son Aktif' : 'Recent'} />
              <SortBtn k="focus"  label={tr ? 'Odak' : 'Focus'} />
              <SortBtn k="tasks"  label={tr ? 'Görev' : 'Tasks'} />
              <SortBtn k="name"   label={tr ? 'İsim' : 'Name'} />
            </View>
          </View>

          {/* ── User count ── */}
          <Text style={{ fontSize: F.caption, fontWeight: '800', color: theme.onSurfaceVariant, letterSpacing: 0.8 }}>
            {tr ? 'KULLANICILAR' : 'USERS'} ({filteredUsers.length}{search ? `/${users.length}` : ''})
          </Text>

          {/* ── User list ── */}
          {filteredUsers.map((user, i) => {
            const isExpanded = expandedUser === user.id;
            const completionRate = user.taskCount > 0 ? Math.round((user.completedTasks / user.taskCount) * 100) : 0;
            const focusHrs = (user.focusMinutes / 60).toFixed(1);
            const isAdmin = user.role === 'Admin';
            const isSelf = user.id === myId;
            const isBanned = !!user.isBanned;

            return (
              <MotiView
                key={user.id}
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 280, delay: Math.min(i * 30, 300) }}
                style={{ backgroundColor: cardBg, borderRadius: R.md, borderWidth: B.thin, borderColor: isAdmin ? '#6366F130' : cardBorder, overflow: 'hidden' }}
              >
                {/* Main row */}
                <Touchable
                  onPress={() => { setExpandedUser(isExpanded ? null : user.id); Haptics.selectionAsync(); }}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: S.md, gap: S.sm }}
                  activeOpacity={0.7}
                >
                  {/* Avatar */}
                  <View style={{ width: 42, height: 42, borderRadius: R.full, backgroundColor: isAdmin ? '#6366F125' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: F.subhead, fontWeight: '900', color: isAdmin ? '#6366F1' : theme.onSurface }}>
                      {(user.name || user.email)[0].toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                      <Text style={{ fontSize: F.body, fontWeight: '700', color: theme.onSurface }} numberOfLines={1}>{user.name}</Text>
                      {isAdmin && (
                        <View style={{ backgroundColor: '#6366F115', borderRadius: R.full, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#6366F1' }}>ADMIN</Text>
                        </View>
                      )}
                      {isBanned && (
                        <View style={{ backgroundColor: theme.error + '20', borderRadius: R.full, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: theme.error }}>{tr ? 'BANLI' : 'BANNED'}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: F.caption, color: theme.onSurfaceVariant, opacity: 0.7 }} numberOfLines={1}>{user.email}</Text>
                    <View style={{ flexDirection: 'row', gap: S.sm, marginTop: 2 }}>
                      <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, opacity: 0.5 }}>
                        {user.taskCount} {tr ? 'görev' : 'tasks'} · {focusHrs}h
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, opacity: 0.4 }}>
                        {formatLastSeen(user.lastActivityAt)}
                      </Text>
                    </View>
                  </View>

                  {isExpanded ? <ChevronUp size={16} color={theme.onSurfaceVariant} /> : <ChevronDown size={16} color={theme.onSurfaceVariant} />}
                </Touchable>

                {/* Expanded detail */}
                {isExpanded && (
                  <View style={{ borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: S.md, gap: S.md }}>
                    {/* Stat row */}
                    <View style={{ flexDirection: 'row', gap: S.sm }}>
                      {[
                        { label: tr ? 'Toplam Görev' : 'Total Tasks', value: user.taskCount, color: '#8B5CF6' },
                        { label: tr ? 'Tamamlanan' : 'Completed', value: user.completedTasks, color: '#10B981' },
                        { label: tr ? 'Odak (saat)' : 'Focus (hrs)', value: focusHrs, color: '#F59E0B' },
                      ].map(s => (
                        <View key={s.label} style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', borderRadius: R.sm, padding: S.sm, alignItems: 'center', gap: 2 }}>
                          <Text style={{ fontSize: F.subhead, fontWeight: '900', color: s.color }}>{s.value}</Text>
                          <Text style={{ fontSize: 9, fontWeight: '600', color: theme.onSurfaceVariant, textAlign: 'center' }}>{s.label}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Completion mini bar */}
                    {user.taskCount > 0 && (
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: '600', color: theme.onSurfaceVariant }}>{tr ? 'Tamamlanma oranı' : 'Completion rate'}</Text>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981' }}>{completionRate}%</Text>
                        </View>
                        <View style={{ height: 5, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: R.full, overflow: 'hidden' }}>
                          <View style={{ width: `${completionRate}%`, height: '100%', backgroundColor: '#10B981', borderRadius: R.full }} />
                        </View>
                      </View>
                    )}

                    {/* IP */}
                    {user.lastLoginIp && (
                      <Text style={{ fontSize: 10, color: theme.onSurfaceVariant, opacity: 0.4 }}>
                        IP: {user.lastLoginIp}
                      </Text>
                    )}

                    {/* Action buttons */}
                    {isSelf ? (
                      <View style={{ alignItems: 'center', paddingVertical: S.xs }}>
                        <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.onSurfaceVariant, opacity: 0.6 }}>
                          {tr ? 'Bu senin hesabın' : 'This is your account'}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: S.sm }}>
                        <Touchable
                          onPress={() => handleToggleRole(user)}
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm, borderRadius: R.md, backgroundColor: isAdmin ? '#6366F115' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'), borderWidth: B.thin, borderColor: isAdmin ? '#6366F130' : cardBorder }}
                        >
                          {isAdmin ? <ShieldOff size={14} color="#6366F1" /> : <Shield size={14} color={theme.onSurfaceVariant} />}
                          <Text style={{ fontSize: F.caption, fontWeight: '700', color: isAdmin ? '#6366F1' : theme.onSurfaceVariant }}>
                            {isAdmin ? (tr ? 'Admin Al' : 'Revoke Admin') : (tr ? 'Admin Yap' : 'Make Admin')}
                          </Text>
                        </Touchable>

                        <View style={{ flexDirection: 'row', gap: S.sm }}>
                          <Touchable
                            onPress={() => handleToggleBan(user)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm, borderRadius: R.md, backgroundColor: isBanned ? '#10B98115' : (isDark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.07)'), borderWidth: B.thin, borderColor: isBanned ? '#10B98140' : '#F59E0B40' }}
                          >
                            {isBanned ? <CheckSquare size={14} color="#10B981" /> : <Ban size={14} color="#F59E0B" />}
                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: isBanned ? '#10B981' : '#F59E0B' }}>
                              {isBanned ? (tr ? 'Banı Kaldır' : 'Unban') : (tr ? 'Banla' : 'Ban')}
                            </Text>
                          </Touchable>

                          <Touchable
                            onPress={() => handleDelete(user)}
                            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: S.xs, paddingVertical: S.sm, borderRadius: R.md, backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)', borderWidth: B.thin, borderColor: theme.error + '30' }}
                          >
                            <Trash2 size={14} color={theme.error} />
                            <Text style={{ fontSize: F.caption, fontWeight: '700', color: theme.error }}>
                              {tr ? 'Hesabı Sil' : 'Delete'}
                            </Text>
                          </Touchable>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </MotiView>
            );
          })}

          {filteredUsers.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
              <Text style={{ color: theme.onSurfaceVariant, opacity: 0.5, fontWeight: '600' }}>
                {tr ? 'Kullanıcı bulunamadı' : 'No users found'}
              </Text>
            </View>
          )}
            </>
          ) : activeTab === 'support' ? (
            <View style={{ gap: S.md }}>
              {messages.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
                  <Text style={{ color: theme.onSurfaceVariant, opacity: 0.5, fontWeight: '600' }}>
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
                          <Text style={{ color: theme.onSurface, fontWeight: '900', fontSize: F.body }}>{m.userName}</Text>
                          {!m.isRead && (
                            <View style={{ backgroundColor: '#3B82F6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>{tr ? 'YENİ' : 'NEW'}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.7 }}>{m.userEmail}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, opacity: 0.5 }}>
                          {new Date(m.createdAt).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Touchable
                          onPress={() => handleDeleteMessage(m)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.error + '12' }}
                          accessibilityRole="button"
                          accessibilityLabel={tr ? 'Mesajı sil' : 'Delete message'}
                        >
                          <Trash2 size={14} color={theme.error} />
                        </Touchable>
                      </View>
                    </View>
                    <Text
                      numberOfLines={expandedMsgs[m.id] ? undefined : 4}
                      style={{ color: theme.onSurface, fontSize: F.body, lineHeight: 20, paddingVertical: 4 }}
                    >
                      {m.message}
                    </Text>
                    {m.message.length > 160 && (
                      <Touchable onPress={() => setExpandedMsgs(e => ({ ...e, [m.id]: !e[m.id] }))} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                        <Text style={{ color: '#3B82F6', fontSize: F.caption, fontWeight: '800' }}>
                          {expandedMsgs[m.id] ? (tr ? 'Daha az' : 'Show less') : (tr ? 'Devamını oku' : 'Read more')}
                        </Text>
                      </Touchable>
                    )}

                    {/* Yanıt: varsa salt-okunur göster, yoksa yanıt kutusu sun */}
                    {m.adminReply ? (
                      <View style={{ backgroundColor: '#10B98112', borderLeftWidth: 3, borderLeftColor: '#10B981', borderRadius: R.sm, padding: S.sm, gap: 2 }}>
                        <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 }}>{tr ? '✓ YANITIN' : '✓ YOUR REPLY'}</Text>
                        <Text style={{ color: theme.onSurface, fontSize: F.caption, lineHeight: 18 }}>{m.adminReply}</Text>
                        {m.repliedAt && (
                          <Text style={{ color: theme.onSurfaceVariant, fontSize: 9, opacity: 0.6 }}>
                            {new Date(m.repliedAt).toLocaleDateString(tr ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: S.xs }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderRadius: 20, paddingHorizontal: S.md, minHeight: 40 }}>
                          <CornerDownRight size={13} color={theme.onSurfaceVariant} style={{ opacity: 0.4 }} />
                          <TextInput
                            value={replyDrafts[m.id] || ''}
                            onChangeText={(t) => setReplyDrafts(d => ({ ...d, [m.id]: t }))}
                            placeholder={tr ? 'Yanıt yaz…' : 'Reply…'}
                            placeholderTextColor={theme.onSurfaceVariant + '70'}
                            multiline
                            maxLength={1000}
                            underlineColorAndroid="transparent"
                            style={{ flex: 1, color: theme.onSurface, fontSize: F.caption, paddingVertical: 9, maxHeight: 100 }}
                          />
                        </View>
                        <Touchable
                          onPress={() => handleReply(m)}
                          disabled={replyingId === m.id || !(replyDrafts[m.id] || '').trim()}
                          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: (replyDrafts[m.id] || '').trim() ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') }}
                        >
                          {replyingId === m.id
                            ? <ActivityIndicator size="small" color="#FFF" />
                            : <Send size={16} color={(replyDrafts[m.id] || '').trim() ? '#FFF' : theme.onSurfaceVariant} />}
                        </Touchable>
                      </View>
                    )}

                    {!m.isRead && (
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 }}>
                        <Touchable
                          onPress={() => handleMarkRead(m)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: S.sm, paddingVertical: 6, borderRadius: R.md }}
                        >
                          <Check size={14} color="#10B981" />
                          <Text style={{ color: '#10B981', fontSize: F.caption, fontWeight: '800' }}>{tr ? 'Okundu Yap' : 'Mark Read'}</Text>
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
              {/* Sağlık kartı */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: sysHealth ? (sysHealth.dbOk ? '#10B981' : '#EF4444') : theme.onSurfaceVariant }} />
                    <Text style={{ color: theme.onSurface, fontWeight: '900', fontSize: F.body }}>{tr ? 'Sistem Sağlığı' : 'System Health'}</Text>
                  </View>
                  <Touchable onPress={loadSystem} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {sysLoading ? <ActivityIndicator size="small" color={theme.primary} /> : <RefreshCw size={15} color={theme.primary} />}
                    <Text style={{ color: theme.primary, fontSize: F.caption, fontWeight: '800' }}>{tr ? 'Yenile' : 'Refresh'}</Text>
                  </Touchable>
                </View>
                {sysHealth ? (
                  <View style={{ gap: 4 }}>
                    {[
                      [tr ? 'Veritabanı' : 'Database', sysHealth.dbOk ? '🟢 OK' : '🔴 Hata'],
                      [tr ? 'Redis' : 'Redis', sysHealth.redisOk == null ? '—' : (sysHealth.redisOk ? '🟢 OK' : '🔴 Hata')],
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
                ) : sysLoading ? <ActivityIndicator color={theme.primary} /> : <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6 }}>{tr ? 'Veri yok' : 'No data'}</Text>}
              </View>

              {/* Bakım aksiyonları */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <Text style={{ color: theme.onSurface, fontWeight: '900', fontSize: F.body }}>{tr ? 'Bakım' : 'Maintenance'}</Text>
                <View style={{ flexDirection: 'row', gap: S.sm }}>
                  {[
                    { key: 'migrate', icon: <Database size={15} color="#3B82F6" />, label: tr ? 'Migration' : 'Migrate', color: '#3B82F6',
                      run: () => runMaintenance('migrate', AdminSystemService.migrate, tr ? 'Migration uygula?' : 'Apply migrations?', tr ? 'Bekleyen veritabanı migration’ları uygulanacak.' : 'Pending DB migrations will be applied.') },
                    { key: 'cache', icon: <Trash2 size={15} color="#F59E0B" />, label: tr ? 'Cache' : 'Cache', color: '#F59E0B',
                      run: () => runMaintenance('cache', AdminSystemService.clearCache, tr ? 'Cache temizle?' : 'Clear cache?', tr ? 'Redis önbelleği temizlenecek.' : 'Redis cache will be cleared.') },
                    { key: 'restart', icon: <Power size={15} color="#EF4444" />, label: tr ? 'Restart' : 'Restart', color: '#EF4444',
                      run: () => runMaintenance('restart', AdminSystemService.restart, tr ? 'Backend yeniden başlatılsın mı?' : 'Restart backend?', tr ? 'Birkaç saniyelik kesinti olur.' : 'Brief downtime (a few seconds).') },
                  ].map((a) => (
                    <Touchable key={a.key} onPress={a.run} disabled={!!sysBusy}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: a.color + '15', borderWidth: B.thin, borderColor: a.color + '40', borderRadius: R.md, paddingVertical: S.sm }}>
                      {sysBusy === a.key ? <ActivityIndicator size="small" color={a.color} /> : a.icon}
                      <Text style={{ color: a.color, fontSize: F.caption, fontWeight: '800' }}>{a.label}</Text>
                    </Touchable>
                  ))}
                </View>
              </View>

              {/* Sentry — son 24s çözülmemiş konular */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={15} color="#8B5CF6" />
                    </View>
                    <View>
                      <Text style={{ color: theme.onSurface, fontWeight: '900', fontSize: F.body }}>Sentry</Text>
                      <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, opacity: 0.6 }}>{tr ? 'son 24 saat' : 'last 24h'}</Text>
                    </View>
                  </View>
                  {sysSentry?.dashboard && (
                    <Touchable onPress={() => Linking.openURL(sysSentry.dashboard!)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '15', paddingHorizontal: S.sm, paddingVertical: 5, borderRadius: R.full }}>
                      <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800' }}>{tr ? 'Panele git' : 'Open'}</Text>
                      <ExternalLink size={12} color={theme.primary} />
                    </Touchable>
                  )}
                </View>
                {!sysSentry ? (
                  <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.6 }}>{tr ? 'Yükleniyor…' : 'Loading…'}</Text>
                ) : !sysSentry.configured ? (
                  <View style={{ backgroundColor: theme.surfaceContainerHigh, borderRadius: R.md, padding: S.sm }}>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.8, lineHeight: 17 }}>{sysSentry.message || (tr ? 'Sentry yapılandırılmamış.' : 'Sentry not configured.')}</Text>
                  </View>
                ) : sysSentry.ok === false ? (
                  <Text style={{ color: theme.error, fontSize: F.caption, fontWeight: '600' }}>{tr ? '⚠ Sentry’ye ulaşılamadı.' : '⚠ Could not reach Sentry.'} {sysSentry.status ? `(HTTP ${sysSentry.status})` : ''}</Text>
                ) : (sysSentry.issues && sysSentry.issues.length > 0) ? (
                  <>
                    {(() => {
                      const fatals = sysSentry.issues!.filter(x => (x.level || '').toLowerCase() === 'fatal').length;
                      const errs = sysSentry.issues!.filter(x => (x.level || '').toLowerCase() === 'error').length;
                      return (
                        <View style={{ flexDirection: 'row', gap: S.xs }}>
                          {fatals > 0 && <View style={{ backgroundColor: '#DC262615', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 }}><Text style={{ color: '#DC2626', fontSize: 10, fontWeight: '900' }}>{fatals} FATAL</Text></View>}
                          {errs > 0 && <View style={{ backgroundColor: '#EF444415', borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 }}><Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '900' }}>{errs} ERROR</Text></View>}
                          <View style={{ backgroundColor: theme.surfaceContainerHigh, borderRadius: R.full, paddingHorizontal: S.sm, paddingVertical: 3 }}><Text style={{ color: theme.onSurfaceVariant, fontSize: 10, fontWeight: '800' }}>{sysSentry.issues!.length} {tr ? 'konu' : 'issues'}</Text></View>
                        </View>
                      );
                    })()}
                    <View>
                      {sysSentry.issues!.slice(0, 6).map((iss, i) => {
                        const st = sentryLevelStyle(iss.level);
                        return (
                          <Touchable key={i} onPress={() => iss.permalink && Linking.openURL(iss.permalink)}
                            style={{ flexDirection: 'row', gap: S.sm, paddingVertical: 8, borderTopWidth: i > 0 ? B.thin : 0, borderTopColor: cardBorder }}>
                            <View style={{ backgroundColor: st.color + '1A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 1 }}>
                              <Text style={{ color: st.color, fontSize: 9, fontWeight: '900' }}>{st.label}</Text>
                            </View>
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text numberOfLines={2} style={{ color: theme.onSurface, fontSize: F.caption, fontWeight: '700', lineHeight: 16 }}>{iss.title}</Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ color: st.color, fontSize: 10, fontWeight: '800' }}>×{iss.count || '1'}</Text>
                                {iss.lastSeen && <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, opacity: 0.6 }}>· {timeAgo(iss.lastSeen, tr)}</Text>}
                              </View>
                            </View>
                            <ExternalLink size={13} color={theme.onSurfaceVariant} style={{ opacity: 0.35, marginTop: 2 }} />
                          </Touchable>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: '#10B98112', borderRadius: R.md, padding: S.sm }}>
                    <Check size={15} color="#10B981" />
                    <Text style={{ color: '#10B981', fontSize: F.caption, fontWeight: '700' }}>{tr ? 'Son 24 saatte çözülmemiş hata yok' : 'No unresolved issues (24h)'}</Text>
                  </View>
                )}
              </View>

              {/* Loglar */}
              <View style={{ backgroundColor: cardBg, borderRadius: R.lg, borderWidth: B.thin, borderColor: cardBorder, padding: S.md, gap: S.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.xs }}>
                    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: theme.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={15} color={theme.onSurfaceVariant} />
                    </View>
                    <View>
                      <Text style={{ color: theme.onSurface, fontWeight: '900', fontSize: F.body }}>{tr ? 'Loglar' : 'Logs'}</Text>
                      {sysHealth && <Text style={{ color: theme.onSurfaceVariant, fontSize: 10, opacity: 0.6 }}>{sysHealth.warnings} {tr ? 'uyarı' : 'warn'} · {sysHealth.errors} {tr ? 'hata' : 'err'}</Text>}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[null, 'Warning', 'Error'].map((lv) => (
                      <Touchable key={lv || 'all'} onPress={() => setSysLogLevel(lv)}
                        style={{ paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.full, backgroundColor: sysLogLevel === lv ? theme.primary : theme.surfaceContainerHigh }}>
                        <Text style={{ color: sysLogLevel === lv ? '#FFF' : theme.onSurfaceVariant, fontSize: 10, fontWeight: '800' }}>{lv ? (lv === 'Warning' ? (tr ? 'Uyarı' : 'Warn') : (tr ? 'Hata' : 'Err')) : (tr ? 'Hepsi' : 'All')}</Text>
                      </Touchable>
                    ))}
                  </View>
                </View>
                {sysLogs.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: S.md }}>
                    <Text style={{ color: theme.onSurfaceVariant, fontSize: F.caption, opacity: 0.5 }}>{tr ? 'Kayıt yok' : 'No logs'}</Text>
                  </View>
                ) : (
                  <View>
                    {sysLogs.slice(0, 60).map((lg, i) => {
                      const st = logLevelStyle(lg.level);
                      return (
                        <View key={i} style={{ gap: 3, borderTopWidth: i > 0 ? B.thin : 0, borderTopColor: cardBorder, paddingVertical: 7 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ backgroundColor: st.color + '1A', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                              <Text style={{ color: st.color, fontSize: 9, fontWeight: '900' }}>{st.label}</Text>
                            </View>
                            <Text numberOfLines={1} style={{ color: theme.onSurfaceVariant, fontSize: 10, fontWeight: '700', flex: 1 }}>{lg.category}</Text>
                            <Text style={{ color: theme.onSurfaceVariant, fontSize: 9, opacity: 0.5 }}>{new Date(lg.timestamp).toLocaleTimeString(tr ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text>
                          </View>
                          <Text numberOfLines={3} style={{ color: theme.onSurface, fontSize: 11, lineHeight: 16, opacity: 0.92 }}>{lg.message}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
