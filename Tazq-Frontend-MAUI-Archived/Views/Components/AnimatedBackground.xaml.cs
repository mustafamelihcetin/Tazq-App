using Microsoft.Maui.Controls;

namespace Tazq_Frontend.Views.Components
{
    public partial class AnimatedBackground : ContentView
    {
        private bool _isAnimating = false;

        public AnimatedBackground()
        {
            InitializeComponent();
            this.Loaded += OnLoaded;
        }

        private void OnLoaded(object sender, EventArgs e)
        {
            StartAnimations();
        }

        private async void StartAnimations()
        {
            if (_isAnimating) return;
            _isAnimating = true;

            // Orb 1 Animation (Drifting)
            _ = AnimateOrb(Orb1, 20000, 50, 50);
            
            // Orb 2 Animation (Scaling & Drifting)
            _ = AnimateOrb(Orb2);

            // Orb 3 Animation (Drifting)
            _ = AnimateOrb(Orb3);
        }

        private async Task AnimateOrb(VisualElement orb)
        {
            var random = new Random();
            
            while (true)
            {
                uint duration = (uint)random.Next(15000, 25000); // Slower for premium feel
                double tx = random.Next(-100, 100);
                double ty = random.Next(-100, 100);
                double opacity = random.NextDouble() * 0.2 + 0.1;

                await Task.WhenAll(
                    orb.TranslateTo(tx, ty, duration, Easing.CubicInOut),
                    orb.FadeTo(opacity, duration / 2, Easing.SinInOut)
                );
            }
        }
    }
}
