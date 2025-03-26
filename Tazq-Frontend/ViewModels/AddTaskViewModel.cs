using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.VisualBasic;
using Tazq_Frontend.Models;
using Tazq_Frontend.Services;

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
		private DateTime? dueDate;

		[ObservableProperty]
		private string selectedPriority = "Medium";

		[ObservableProperty]
		private ObservableCollection<string> tags = new();

		public ObservableCollection<string> PriorityOptions { get; }

		[RelayCommand]
		private async Task AddTask()
		{
			if (string.IsNullOrWhiteSpace(Title)) return;

			var newTask = new TaskModel
			{
				Title = Title,
				Description = Description,
				DueDate = DueDate,
				Priority = SelectedPriority,
				Tags = Tags.ToArray(),
				IsCompleted = false
			};

			await _apiService.AddTask(newTask);

			// Reset form after submission
			Title = string.Empty;
			Description = string.Empty;
			DueDate = null;
			Tags.Clear();
		}
	}
}
