using System;
using System.Web;
using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views
{
    public partial class EditTaskPage : ContentPage
    {
        public EditTaskPage()
        {
            InitializeComponent();
        }

        // Event handler for tag completion
        private void OnTagCompleted(object sender, EventArgs e)
        {
            if (BindingContext is EditTaskViewModel vm && !string.IsNullOrWhiteSpace(vm.NewTag))
            {
                // Check if the tag doesn't already exist, then add it
                if (!vm.Tags.Contains(vm.NewTag))
                    vm.Tags.Add(vm.NewTag);

                // Clear the input field after adding the tag
                vm.NewTag = string.Empty;
            }
        }
        protected override async void OnAppearing()
        {
            base.OnAppearing();

            var taskId = Shell.Current.CurrentState?.Location.OriginalString;
            if (taskId != null)
            {
                var uri = new Uri(taskId);
                var queryParams = HttpUtility.ParseQueryString(uri.Query);
                var taskIdValue = queryParams["taskId"];

                if (int.TryParse(taskIdValue, out int id))
                {
                    var viewModel = (EditTaskViewModel)BindingContext;
                    await viewModel.LoadTaskById(id);
                }
            }
        }
    }
}