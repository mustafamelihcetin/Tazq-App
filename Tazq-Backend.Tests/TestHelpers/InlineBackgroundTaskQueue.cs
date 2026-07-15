using Microsoft.Extensions.DependencyInjection;
using Tazq_App.Services;

namespace Tazq_Backend.Tests.TestHelpers
{
    // Testlerde kuyruğa alınan işi hemen, senkron olarak çalıştırır.
    // Böylece kuyruğa devredilen yan işler (doğrulama maili gibi) test edilebilir kalır —
    // no-op bir sahte kullanılsaydı bu davranış testlerden tamamen görünmez olurdu.
    public class InlineBackgroundTaskQueue : IBackgroundTaskQueue
    {
        private readonly IServiceProvider _services;
        public int ExecutedCount { get; private set; }

        public InlineBackgroundTaskQueue(params object[] servicesToResolve)
        {
            var collection = new ServiceCollection();
            foreach (var svc in servicesToResolve)
            {
                // Mock'lar arayüzlerini implemente eder; kayıtları arayüz tipleriyle yap.
                foreach (var iface in svc.GetType().GetInterfaces())
                    collection.AddSingleton(iface, svc);
            }
            _services = collection.BuildServiceProvider();
        }

        public void Enqueue(Func<IServiceProvider, CancellationToken, Task> work)
        {
            ExecutedCount++;
            // Testlerde deterministik olsun diye beklenir; üretimdeki kuyruk asenkron çalışır.
            work(_services, CancellationToken.None).GetAwaiter().GetResult();
        }

        public ValueTask<Func<IServiceProvider, CancellationToken, Task>> DequeueAsync(CancellationToken ct)
            => throw new NotSupportedException("Inline queue executes on enqueue; nothing to dequeue.");
    }
}
