using System.Collections.ObjectModel;
using System.Windows.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
using CommunityToolkit.Mvvm.Messaging.Messages;
using Microsoft.Maui.Controls;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;
using Tazq_Frontend.Views;

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

			LoadTasksCommand.Execute(null);

			// Dinleyici: Görev eklendiğinde görevleri güncelle
			WeakReferenceMessenger.Default.Register<TaskAddedMessage>(this, async (r, m) =>
			{
				await LoadTasks();
			});
		}

		[ObservableProperty]
		private ObservableCollection<TaskModel> _tasks = new();

		public IAsyncRelayCommand LoadTasksCommand { get; }

		public IAsyncRelayCommand LogoutCommand { get; }

		public IAsyncRelayCommand SettingsCommand { get; }

		private async Task LoadTasks()
		{
			var taskList = await _apiService.GetTasks();
			Tasks.Clear();
			foreach (var task in taskList)
			{
				Tasks.Add(task);
			}
		}

		private async Task Logout()
		{
			await SecureStorage.Default.SetAsync("jwt_token", string.Empty);

			if (Shell.Current != null)
			{
				await Shell.Current.GoToAsync("//LoginPage");
			}
		}

		private async Task OpenSettings()
		{
			await Application.Current?.MainPage?.DisplayAlert("Ayarlar", "Ayarlar sayfası yakında gelecek.", "Tamam");
		}

		[RelayCommand]
		private async Task GoToAddTaskPage()
		{
			await Shell.Current.GoToAsync(nameof(AddTaskPage));
		}
	}

	//// WeakReference mesaj tipi
	//public class TaskAddedMessage : ValueChangedMessage<bool>
	//{
	//	public TaskAddedMessage() : base(true) { }
	//}
}