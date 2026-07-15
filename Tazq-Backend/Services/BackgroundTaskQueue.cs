using System.Threading.Channels;

namespace Tazq_App.Services
{
    // Request dışında çalışacak yan işler (mail gönderimi gibi) için kuyruk.
    //
    // Neden gerekli: bu işler daha önce `_ = Task.Run(...)` ile başlatılıyordu. Bu desenin
    // iki sorunu vardı: (1) closure request'in scoped servislerini yakalıyordu; request bitip
    // DI scope'u dispose edildiğinde iş hâlâ çalışıyorsa ObjectDisposedException alıyordu,
    // (2) task await edilmediği için bu exception hiçbir yere ulaşmıyor, mail sessizce
    // kayboluyordu. Kuyruk her iş için taze bir scope açar ve hataları loglar.
    public interface IBackgroundTaskQueue
    {
        void Enqueue(Func<IServiceProvider, CancellationToken, Task> work);
        ValueTask<Func<IServiceProvider, CancellationToken, Task>> DequeueAsync(CancellationToken ct);
    }

    public class BackgroundTaskQueue : IBackgroundTaskQueue
    {
        private readonly Channel<Func<IServiceProvider, CancellationToken, Task>> _queue;
        private readonly ILogger<BackgroundTaskQueue> _logger;

        public BackgroundTaskQueue(ILogger<BackgroundTaskQueue> logger)
        {
            _logger = logger;
            // Sınırlı kapasite: kuyruk dolarsa en eskiyi düşür. Sınırsız kuyruk, arka uç
            // (SMTP) tıkandığında belleği şişirir ve süreci düşürür.
            _queue = Channel.CreateBounded<Func<IServiceProvider, CancellationToken, Task>>(
                new BoundedChannelOptions(1000)
                {
                    FullMode = BoundedChannelFullMode.DropOldest,
                    SingleReader = true,
                });
        }

        public void Enqueue(Func<IServiceProvider, CancellationToken, Task> work)
        {
            ArgumentNullException.ThrowIfNull(work);
            if (!_queue.Writer.TryWrite(work))
                _logger.LogWarning("Background task queue rejected a work item (queue closed or full).");
        }

        public ValueTask<Func<IServiceProvider, CancellationToken, Task>> DequeueAsync(CancellationToken ct)
            => _queue.Reader.ReadAsync(ct);
    }

    // Kuyruğu tüketen tek arka plan işçisi. Her iş kendi DI scope'unda çalışır;
    // bir işin hatası işçiyi düşürmez.
    public class QueuedHostedService : BackgroundService
    {
        private readonly IBackgroundTaskQueue _queue;
        private readonly IServiceProvider _services;
        private readonly ILogger<QueuedHostedService> _logger;

        public QueuedHostedService(IBackgroundTaskQueue queue, IServiceProvider services, ILogger<QueuedHostedService> logger)
        {
            _queue = queue;
            _services = services;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                Func<IServiceProvider, CancellationToken, Task> work;
                try
                {
                    work = await _queue.DequeueAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break; // Uygulama kapanıyor — normal çıkış.
                }

                try
                {
                    using var scope = _services.CreateScope();
                    await work(scope.ServiceProvider, stoppingToken);
                }
                catch (Exception ex)
                {
                    // Yutulmaz: yan iş başarısız olsa bile iz bırakır ve işçi ayakta kalır.
                    _logger.LogError(ex, "Background work item failed.");
                }
            }
        }
    }
}
