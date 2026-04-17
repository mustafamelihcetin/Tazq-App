using Microsoft.Maui.Devices;

namespace Tazq_Frontend.Services;

public class HapticService : IHapticService
{
    public void SelectionChanged()
    {
        try 
        {
            HapticFeedback.Default.Perform(HapticFeedbackType.Click);
        }
        catch { }
    }

    public void Success()
    {
        try 
        {
            // Note: MAUI's cross-platform API is limited. 
            // In a real device with native code, we'd use UINotificationFeedbackGenerator(Success)
            HapticFeedback.Default.Perform(HapticFeedbackType.Click);
            
            // Double tap simulation for success feel
            _ = Task.Delay(50).ContinueWith(_ => HapticFeedback.Default.Perform(HapticFeedbackType.Click));
        }
        catch { }
    }

    public void Warning()
    {
        try 
        {
            HapticFeedback.Default.Perform(HapticFeedbackType.LongPress);
        }
        catch { }
    }

    public void HeavyClick()
    {
        try 
        {
            HapticFeedback.Default.Perform(HapticFeedbackType.LongPress);
        }
        catch { }
    }
}
