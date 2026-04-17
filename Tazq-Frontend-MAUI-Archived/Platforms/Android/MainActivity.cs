using Android.App;
using Android.Content.PM;
using Android.OS;
using Android.Views;

namespace Tazq_Frontend;

[Activity(Theme = "@style/Maui.MainTheme", MainLauncher = true, LaunchMode = LaunchMode.SingleTop,
    ConfigurationChanges = ConfigChanges.ScreenSize | ConfigChanges.Orientation | ConfigChanges.UiMode |
    ConfigChanges.ScreenLayout | ConfigChanges.SmallestScreenSize | ConfigChanges.Density)]
public class MainActivity : MauiAppCompatActivity
{
    protected override void OnCreate(Bundle? savedInstanceState)
    {
        base.OnCreate(savedInstanceState);

        // Enable Edge-to-Edge
        if (Android.OS.Build.VERSION.SdkInt >= Android.OS.BuildVersionCodes.Lollipop)
        {
            Microsoft.Maui.ApplicationModel.Platform.CurrentActivity?.Window?.SetFlags(
                Android.Views.WindowManagerFlags.LayoutNoLimits,
                Android.Views.WindowManagerFlags.LayoutNoLimits);
        }
    }
}