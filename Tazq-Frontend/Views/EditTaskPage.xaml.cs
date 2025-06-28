using Tazq_Frontend.ViewModels;

namespace Tazq_Frontend.Views
{
    [QueryProperty(nameof(TaskIdQuery), "taskId")]
    public partial class EditTaskPage : ContentPage
    {
        private readonly EditTaskViewModel _viewModel;

        public EditTaskPage()
        {
            InitializeComponent();
            _viewModel = new EditTaskViewModel();
            BindingContext = _viewModel;
        }

        private string taskIdQuery = string.Empty;
        public string TaskIdQuery
        {
            get => taskIdQuery;
            set
            {
                taskIdQuery = value;
                Console.WriteLine($">>> Query'den gelen taskId: {taskIdQuery}");

                if (int.TryParse(taskIdQuery, out int id))
                {
                    _ = LoadTask(id);
                }
                else
                {
                    Console.WriteLine(">>> taskId geçerli deðil!");
                }
            }
        }

        private async Task LoadTask(int id)
        {
            await _viewModel.LoadTaskById(id);
            Console.WriteLine($">>> Title: {_viewModel.Title}");
        }

        private void OnTagCompleted(object sender, EventArgs e)
        {
            if (!string.IsNullOrWhiteSpace(_viewModel.NewTag) && !_viewModel.Tags.Contains(_viewModel.NewTag))
            {
                _viewModel.Tags.Add(_viewModel.NewTag);
                _viewModel.NewTag = string.Empty;
            }
        }

        private async void OnBackClicked(object sender, EventArgs e)
        {
            await Shell.Current.GoToAsync("..");
        }
    }
}