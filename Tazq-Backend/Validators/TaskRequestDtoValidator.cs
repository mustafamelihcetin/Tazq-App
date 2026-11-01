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

            // Kötüye kullanım koruması (2026-11-01). Kullanıcının yazdığı not istemcide 1000'le sınırlı
            // (TASK_LIMITS.description); bu alan mod görevlerinin iki dilli JSON yükünü de taşıdığı için
            // sunucu sınırı daha geniş — yük 1000'i aşabiliyor, reddedilirse mod görevi kaydedilemez.
            RuleFor(x => x.Description)
                .MaximumLength(4000).WithMessage("Açıklama çok uzun.");

            RuleFor(x => x.DueDate)
                .GreaterThanOrEqualTo(DateTime.Today.AddDays(-1)).When(x => x.DueDate.HasValue).WithMessage("Bitiş tarihi geçmişte olamaz.");
        }
    }
}
