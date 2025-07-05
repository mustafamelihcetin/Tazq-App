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
    protected override void OnCreate(Bundle? savedInstanceState)  // Nullable parametre
    {
        base.OnCreate(savedInstanceState);

        // Null kontrolü ekledik
        if (savedInstanceState != null)
        {
        }

        if (Build.VERSION.SdkInt >= BuildVersionCodes.Lollipop)
        {
            Window.SetStatusBarColor(Android.Graphics.Color.Black);
        }

        if (Build.VERSION.SdkInt >= BuildVersionCodes.M)
        {
            Window.DecorView.SystemUiVisibility = (StatusBarVisibility)SystemUiFlags.Visible;
        }

        Window.SetBackgroundDrawable(new Android.Graphics.Drawables.ColorDrawable(Android.Graphics.Color.Black));
    }
}