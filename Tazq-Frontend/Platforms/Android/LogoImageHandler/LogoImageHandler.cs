using Android.Widget;
using Microsoft.Maui.Handlers;

namespace Tazq_Frontend;

public class LogoImageHandler : ImageHandler
{
    protected override ImageView CreatePlatformView()
    {
        var view = base.CreatePlatformView();
        view.SetBackgroundColor(Android.Graphics.Color.Transparent);
        return view;
    }
}