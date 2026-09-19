import { useWalletStore } from '../store/useWalletStore';
import { useTaskStore } from '@/features/tasks/store/useTaskStore';
import { TaskService } from '@/shared/services/api';
import { useNetworkStore } from '@/shared/store/useNetworkStore';
import { useOfflineQueue } from '@/shared/store/useOfflineQueue';
import { swallow } from '@/shared/utils/swallow';

const getLocalDateString = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const syncSubscriptionsToTasks = async (tr: boolean = true) => {
  const { subscriptions, updateSubscriptionTask } = useWalletStore.getState();
  const { addTask } = useTaskStore.getState();
  const isOnline = useNetworkStore.getState().isOnline;

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  for (const sub of subscriptions) {
    // Determine the next billing date
    let billingDate = new Date(currentYear, currentMonth, sub.billingDay);
    
    // If billing day has already passed this month, move to next month
    if (billingDate < today && today.getDate() > sub.billingDay) {
      billingDate = new Date(currentYear, currentMonth + 1, sub.billingDay);
    }

    // Check if the billing date is within the next 3 days
    const diffTime = billingDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 3) {
      // It's coming up! Check if we already created a task for it.
      // To avoid duplicates, we can check if a task with a specific tag exists, 
      // or simply rely on sub.taskId. However, sub.taskId might be from last month.
      // Let's create a new task if one doesn't exist for THIS billing cycle.
      
      const tasks = useTaskStore.getState().tasks;
      const billingDateStr = getLocalDateString(billingDate);
      
      const existingTask = tasks.find(t => 
        t.tags?.includes('wallet_subscription') && 
        t.tags?.includes(`sub_${sub.id}`) &&
        t.dueDate === billingDateStr
      );

      if (!existingTask) {
        // Create the task
        const titleTr = `${sub.name} faturası yaklaşıyor (${sub.amount}₺)`;
        const titleEn = `${sub.name} bill is coming up (${sub.amount}₺)`;
        
        const payload = {
          title: tr ? titleTr : titleEn,
          description: JSON.stringify({ 
            tr: `${sub.name} aboneliğin için ${getLocalDateString(billingDate)} tarihinde ${sub.amount}₺ ödemen var.`,
            en: `You have an upcoming payment of ${sub.amount}₺ for ${sub.name} on ${getLocalDateString(billingDate)}.`
          }),
          priority: 'High' as const,
          dueDate: billingDateStr,
          isCompleted: false,
          tags: ['wallet_subscription', `sub_${sub.id}`]
        };

        if (!isOnline) {
          const tempId = -Date.now() - Math.floor(Math.random() * 1000);
          useOfflineQueue.getState().enqueue({ type: 'create-task', tempId, payload });
          addTask({ ...payload, id: tempId } as any);
          updateSubscriptionTask(sub.id, tempId);
        } else {
          try {
            const t = await TaskService.createTask(payload as any);
            if (t?.id) {
              addTask(t);
              updateSubscriptionTask(sub.id, t.id);
            }
          } catch (error) {
            swallow('syncSubscriptionsToTasks', error, { capture: true });
          }
        }
      }
    }
  }
};
