import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Users, CheckSquare, Clock, Trash2, Shield, ShieldOff,
  Search, TrendingUp, Zap, Activity, ChevronDown, ChevronUp, Ban,
} from 'lucide-react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAuthStore } from '../store/useAuthStore';
import { AdminService, AdminUser, AdminStats } from '../services/api';
import { S, R, F, B } from '../constants/tokens';
import * as Haptics from 'expo-haptics';
import { Touchable } from '@/components/Touchable';
import { CustomAlert as Alert } from '../components/CustomAlert';

type SortKey = 'name' | 'tasks' | 'focus' | 'recent';

export default function AdminScreen() {
  const { theme, colorScheme } = useAppTheme();
  const { language } = useLanguageStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const tr = language === 'tr';
  const myId = useAuthStore(s => s.user?.id);

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
      const [s, u] = await Promise.all([AdminService.getStats(), AdminService.getUsers()]);
      setStats(s);
      setUsers(u);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
          contentContainerStyle={{ paddingHorizontal: S.md, paddingBottom: insets.bottom + S.xl, gap: S.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={theme.primary} colors={[theme.primary]} progressBackgroundColor={theme.surface} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Stat cards row 1 ── */}
          {stats && (
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
