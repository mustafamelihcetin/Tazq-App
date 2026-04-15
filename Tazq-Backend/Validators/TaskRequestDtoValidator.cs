using FluentValidation;
using Tazq_App.Models;

namespace Tazq_App.Validators
{
    public class TaskRequestDtoValidator : AbstractValidator<TaskRequestDto>
    {
        public TaskRequestDtoValidator()
        {
            RuleForEach(x => x.Tasks).SetValidator(new TaskDtoValidator());
        }
    }

    public class TaskDtoValidator : AbstractValidator<TaskDto>
    {
        public TaskDtoValidator()
        {
            RuleFor(x => x.Title)
                .NotEmpty().WithMessage("Görev başlığı boş olamaz.")
                .MaximumLength(100).WithMessage("Görev başlığı en fazla 100 karakter olabilir.");

            RuleFor(x => x.DueDate)
                .GreaterThanOrEqualTo(DateTime.Today.AddDays(-1)).WithMessage("Bitiş tarihi geçmişte olamaz.");
        }
    }
}
