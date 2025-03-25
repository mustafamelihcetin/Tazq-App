using System.Collections.ObjectModel;
using System.Windows.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;

namespace Tazq_Frontend.ViewModels
{
	public partial class HomeViewModel : ObservableObject
	{
		private readonly ApiService _apiService;

		public HomeViewModel()
		{
			_apiService = new ApiService();
			Tasks = new ObservableCollection<TaskModel>();
			LoadTasksCommand = new AsyncRelayCommand(LoadTasks);
			LogoutCommand = new AsyncRelayCommand(Logout);
			SettingsCommand = new AsyncRelayCommand(OpenSettings);

			// Load tasks initially
			LoadTasksCommand.Execute(null);
		}

		// Observable task list
		[ObservableProperty]
		private ObservableCollection<TaskModel> tasks;

		// Command to load tasks
		public IAsyncRelayCommand LoadTasksCommand { get; }

		// Command to log out
		public IAsyncRelayCommand LogoutCommand { get; }

		// Command to open settings
		public IAsyncRelayCommand SettingsCommand { get; }

		// Load user tasks from API
		private async Task LoadTasks()
		{
			var taskList = await _apiService.GetTasks();
			Tasks.Clear();
			foreach (var task in taskList)
			{
				Tasks.Add(task);
			}
		}

		// Logout user
		private async Task Logout()
		{
			await SecureStorage.Default.SetAsync("jwt_token", string.Empty);

			if (Shell.Current != null)
			{
				await Shell.Current.GoToAsync("//LoginPage");
			}
		}

		// Navigate to Settings (placeholder)
		private async Task OpenSettings()
		{
			await Application.Current?.MainPage?.DisplayAlert("Ayarlar", "Ayarlar sayfası yakında gelecek.", "Tamam");
		}
	}
}
