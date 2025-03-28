﻿ using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CommunityToolkit.Mvvm.Messaging.Messages;
using CommunityToolkit.Mvvm.Messaging;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;
using Tazq_Frontend.ViewModels;


namespace Tazq_Frontend.ViewModels
{
	public partial class AddTaskViewModel : ObservableObject
	{
		private readonly ApiService _apiService;

		public AddTaskViewModel()
		{
			_apiService = new ApiService();
			Tags = new ObservableCollection<string>();
			PriorityOptions = new ObservableCollection<string> { "Low", "Medium", "High" };
		}

		[ObservableProperty]
		private string title = string.Empty;

		[ObservableProperty]
		private string description = string.Empty;

		[ObservableProperty]
		private DateTime? dueDate = DateTime.Today.AddDays(1);

		[ObservableProperty]
		private string selectedPriority = "Medium";

		[ObservableProperty]
		private ObservableCollection<string> tags = new();

		public ObservableCollection<string> PriorityOptions { get; }

		[ObservableProperty]
		private string? newTag;

		[RelayCommand]
		private async Task AddTask()
		{
			Console.WriteLine("AddTaskCommand tetiklendi.");

			if (string.IsNullOrWhiteSpace(Title))
			{
				await Shell.Current.DisplayAlert("Uyarı", "Başlık boş olamaz.", "Tamam");
				return;
			}

			if (DueDate == null)
			{
				await Shell.Current.DisplayAlert("Uyarı", "Son tarih seçilmelidir.", "Tamam");
				return;
			}

			// Convert SelectedPriority string to enum int
			bool parseSuccess = Enum.TryParse(typeof(TaskPriority), SelectedPriority, out var parsedEnum);
			if (!parseSuccess)
			{
				await Shell.Current.DisplayAlert("Hata", "Öncelik değeri geçersiz.", "Tamam");
				return;
			}

			var priorityInt = (int)parsedEnum!;

			var newTask = new TaskModel
			{
				Title = Title,
				Description = Description,
				DueDate = DueDate?.ToUniversalTime(),
				IsCompleted = false,
				Tags = Tags.ToList(),
				Priority = priorityInt.ToString()
			};

			bool result = await _apiService.AddTask(newTask);

			Console.WriteLine($"AddTask API sonucu: {result}");

			if (result)
			{
				WeakReferenceMessenger.Default.Send(new TaskAddedMessage());
				await Shell.Current.GoToAsync("..");
			}
			else
			{
				await Shell.Current.DisplayAlert("Hata", "Görev kaydedilemedi.", "Tamam");
			}
		}
	}

	public class TaskAddedMessage : ValueChangedMessage<bool>
	{
		public TaskAddedMessage() : base(true) { }
	}
}