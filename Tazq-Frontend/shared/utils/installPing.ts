import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pingInstall } from '@/shared/services/api';
import { swallow } from '@/shared/utils/swallow';

const ID_KEY = 'tazq_install_id';
const PING_KEY = 'tazq_install_ping_at';
const DAY_MS = 24 * 60 * 60 * 1000;

function randomInstallId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Kayıtsız (misafir) cihazları anonim olarak saymak için — günde en fazla bir kez.
 * Kimlik rastgele bir UUID, cihazda saklanır; kişisel veri gönderilmez. Hata sessizce
 * yutulur: sayım eksik kalabilir ama uygulama hiçbir zaman bundan etkilenmez.
 */
export async function reportInstallOncePerDay(): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const last = Number(await AsyncStorage.getItem(PING_KEY)) || 0;
    if (Date.now() - last < DAY_MS) return;
    let id = await AsyncStorage.getItem(ID_KEY);
    if (!id) {
      id = randomInstallId();
      await AsyncStorage.setItem(ID_KEY, id);
    }
    await pingInstall(id, Platform.OS);
    await AsyncStorage.setItem(PING_KEY, String(Date.now()));
  } catch (e) {
    swallow('installPing', e);
  }
}
