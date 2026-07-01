import { Share, Platform } from 'react-native';

export interface ShareableTask {
  id: number;
  title: string;
  description?: string;
  dueDate?: string | null;
  priority?: string;
  tags?: string[];
  subtasks?: { text: string; done: boolean }[];
}

// Deep link base — swap to production URL when ready
const DEEP_LINK_BASE = 'tazq://task';
// const WEB_BASE = 'https://tazq.app/task'; // enable when web is live

function formatDueDate(dueDateStr?: string | null, lang = 'tr'): string {
  if (!dueDateStr || dueDateStr.startsWith('0001')) return '';
  const d = new Date(dueDateStr);
  return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatPriority(priority?: string, lang = 'tr'): string {
  const map: Record<string, { tr: string; en: string }> = {
    High:   { tr: '🔴 Yüksek',  en: '🔴 High'   },
    Medium: { tr: '🟡 Orta',    en: '🟡 Medium'  },
    Low:    { tr: '🟢 Düşük',   en: '🟢 Low'     },
  };
  if (!priority) return '';
  return (lang === 'tr' ? map[priority]?.tr : map[priority]?.en) ?? priority;
}

export async function shareTask(task: ShareableTask, lang = 'tr'): Promise<boolean> {
  const isTR = lang === 'tr';
  const lines: string[] = [];

  lines.push(isTR ? `📋 Görev: ${task.title}` : `📋 Task: ${task.title}`);

  if (task.description?.trim()) {
    lines.push(isTR ? `📝 Açıklama: ${task.description}` : `📝 Description: ${task.description}`);
  }

  const dateStr = formatDueDate(task.dueDate, lang);
  if (dateStr) lines.push(isTR ? `📅 Son Tarih: ${dateStr}` : `📅 Due: ${dateStr}`);

  const priorityStr = formatPriority(task.priority, lang);
  if (priorityStr) lines.push(isTR ? `${priorityStr} Öncelik` : `${priorityStr} Priority`);

  const visibleTags = (task.tags ?? []).filter(t => t !== 'hatırlatıcı' && t !== 'reminder');
  if (visibleTags.length > 0) {
    lines.push(`🏷️ ${visibleTags.join(', ')}`);
  }

  if ((task.subtasks ?? []).length > 0) {
    lines.push('');
    lines.push(isTR ? 'Alt görevler:' : 'Subtasks:');
    task.subtasks!.forEach(s => {
      lines.push(`${s.done ? '✅' : '⬜'} ${s.text}`);
    });
  }

  lines.push('');
  lines.push(isTR ? '— TAZQ ile paylaşıldı' : '— Shared via TAZQ');

  // Future: append deep link when backend share tokens are ready
  // lines.push(`${DEEP_LINK_BASE}/${task.id}`);

  try {
    const result = await Share.share({
      message: lines.join('\n'),
      title: task.title,
    });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}

export async function shareTaskList(
  tasks: ShareableTask[],
  listName: string,
  lang = 'tr'
): Promise<boolean> {
  const isTR = lang === 'tr';
  const lines: string[] = [];

  lines.push(isTR ? `📋 ${listName}` : `📋 ${listName}`);
  lines.push('');

  tasks.forEach((task, i) => {
    const dateStr = formatDueDate(task.dueDate, lang);
    const datePart = dateStr ? ` (${dateStr})` : '';
    lines.push(`${i + 1}. ${task.title}${datePart}`);
    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(s => {
        lines.push(`   ${s.done ? '✅' : '⬜'} ${s.text}`);
      });
    }
  });

  lines.push('');
  lines.push(isTR ? '— TAZQ ile paylaşıldı' : '— Shared via TAZQ');

  try {
    const result = await Share.share({
      message: lines.join('\n'),
      title: listName,
    });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
