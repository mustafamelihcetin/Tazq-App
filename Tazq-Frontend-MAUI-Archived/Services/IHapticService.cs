namespace Tazq_Frontend.Services;

public interface IHapticService
{
    void SelectionChanged();
    void Success();
    void Warning();
    void HeavyClick();
}
