using Microsoft.Maui.Networking;

namespace Tazq_Frontend.Services
{
    public class ConnectivityService
    {
        public event EventHandler<bool>? ConnectivityChanged;

        public ConnectivityService()
        {
            Connectivity.Current.ConnectivityChanged += OnConnectivityChanged;
        }

        public bool IsConnected => Connectivity.Current.NetworkAccess == NetworkAccess.Internet;

        private void OnConnectivityChanged(object? sender, ConnectivityChangedEventArgs e)
        {
            ConnectivityChanged?.Invoke(this, e.NetworkAccess == NetworkAccess.Internet);
        }
    }
}
