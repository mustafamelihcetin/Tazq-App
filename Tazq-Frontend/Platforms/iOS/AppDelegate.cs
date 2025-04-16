using Foundation;
using UIKit;

namespace Tazq_Frontend;

[Register("AppDelegate")]
public class AppDelegate : MauiUIApplicationDelegate
{
    protected override MauiApp CreateMauiApp() => MauiProgram.CreateMauiApp();

    public override UIWindow? Window { get; set; }

    public override bool FinishedLaunching(UIApplication app, NSDictionary options)
    {
        var result = base.FinishedLaunching(app, options);

        // iOS global dark mod override
        Window!.OverrideUserInterfaceStyle = UIUserInterfaceStyle.Dark;

        return result;
    }
}
