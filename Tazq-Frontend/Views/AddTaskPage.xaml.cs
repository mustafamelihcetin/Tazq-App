using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views;

public partial class AddTaskPage : ContentPage
{
	public AddTaskPage()
	{
		InitializeComponent();
		BindingContext = new AddTaskViewModel();
    }

    // Handles tag entry completion and adds tag to the list
    private void OnTagCompleted(object sender, EventArgs e)
    {
        if (BindingContext is AddTaskViewModel vm &&
            sender is Entry entry &&
            !string.IsNullOrWhiteSpace(entry.Text))
        {
            if (!vm.Tags.Contains(entry.Text))
            {
                vm.Tags.Add(entry.Text);
            }
            entry.Text = string.Empty;
        }
    }

    private async void OnBackClicked(object sender, EventArgs e)
    {
        await Shell.Current.GoToAsync("..");
    }
}
