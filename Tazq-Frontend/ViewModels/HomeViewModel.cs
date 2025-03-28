﻿using System.Collections.ObjectModel;
using System.Windows.Input;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging;
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

			// Listener: Refresh task list when a task is added
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

		[ObservableProperty]
		private bool isLoading = false;

		private async Task LoadTasks()
		{
			IsLoading = true;
			try
			{
				var taskList = await _apiService.GetTasks();
				Tasks.Clear();
				foreach (var task in taskList)
				{
					Tasks.Add(task);
				}
			}
			catch (Exception ex)
			{
				Console.WriteLine($"Hata: {ex.Message}");
			}
			finally
			{
				IsLoading = false;
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
}