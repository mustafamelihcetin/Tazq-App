using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Tazq_App.Data;
using Tazq_App.Models;
using System.Text.Json;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
    [Route("api/tasks")]
    [ApiController]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly ITaskService _taskService;

        public TasksController(ITaskService taskService)
        {
            _taskService = taskService;
        }

        private int? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out int userId))
                return userId;
            return null;
        }

        [HttpGet]
        public async Task<IActionResult> GetTasks(
            [FromQuery] string? tag,
            [FromQuery] string? search,
            [FromQuery] string? sortBy,
            [FromQuery] bool? isCompleted,
            [FromQuery] DateTime? startDate,
            [FromQuery] DateTime? endDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized(new { status = 401, message = "Invalid or missing user ID in token." });

            /*
              SAYFA PARAMETRELERİ SINIRSIZDI — istemciden geldiği gibi kullanılıyordu.

              İki somut sonucu vardı:
                · `?pageSize=100000` → kullanıcı başına izinli 5000 görevin tamamı tek
                  istekte çekilir ve HER BİRİ AES ile çözülür. Kimlik doğrulaması olan
                  ama ucuz bir servis dışı bırakma yolu.
                · `?page=0` → `Skip((0-1)*50)` = `Skip(-50)`; PostgreSQL negatif OFFSET
                  kabul etmez, istek 500'e düşer.

              ÜST SINIR NEDEN TAM 200: istemci her zaman `pageSize: 200` gönderiyor ve
              sayfaları `items.length < PAGE_SIZE` olana kadar döngüyle çekiyor
              (shared/services/api.ts → TaskService.getTasks). Sınır 200'ün ALTINA
              çekilseydi sunucu 100 kayıt döndürür, istemci bunu "son sayfa" sanıp
              döngüden çıkar ve kullanıcının geri kalan görevleri UYGULAMADAN KAYBOLURDU.
              Git geçmişindeki tüm istemci sürümleri de 200 gönderiyor; yani 200
              mağazadaki her sürüm için etkisiz, sadece elle atılan istekleri bağlar.

              Etkin değerler cevapta geri dönüyor: `totalPages` hesabı ile istemcinin
              döngü koşulu aynı sayıya bakmalı.
            */
            page = Math.Max(page, 1);
            pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

            var (items, totalCount) = await _taskService.GetTasksAsync(userId.Value, tag, search, sortBy, isCompleted, startDate, endDate, page, pageSize);
            return Ok(new
            {
                items,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        // İstemcinin kullandığı sayfa boyutu (shared/services/api.ts → PAGE_SIZE).
        // Düşürülmesi mağazadaki istemcilerde veri kaybına yol açar; bkz. GetTasks.
        private const int MaxPageSize = 200;

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTaskById(int id)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("User ID not found in token.");

            var task = await _taskService.GetTaskByIdAsync(userId.Value, id);
            if (task == null)
                return NotFound();

            return Ok(task);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTask([FromBody] TaskItem task)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized("User ID not found in token.");

            try
            {
                var createdTask = await _taskService.CreateTaskAsync(userId.Value, task);
                return CreatedAtAction(nameof(GetTaskById), new { id = createdTask.Id }, createdTask);
            }
            // Kota aşımı → 429. İki tür: aktif görev tavanı (TASK_LIMIT_REACHED) ve
            // depolama emniyet freni (TASK_STORAGE_LIMIT_REACHED). İstemci mesajdan ayırt eder.
            catch (InvalidOperationException ex) when (
                ex.Message.StartsWith("TASK_LIMIT_REACHED") || ex.Message.StartsWith("TASK_STORAGE_LIMIT_REACHED"))
            {
                return StatusCode(429, new { StatusCode = 429, Message = ex.Message });
            }
            /*
              HATA DETAYI İSTEMCİYE ÇIKMAZ.

              Burada `ex.Message` döndürülüyordu. Bu `catch` her şeyi yakalıyor —
              en olası kaynak Npgsql; onun mesajları tablo/sütun adını, kısıt adını
              ve kimi zaman değeri taşır. Yani beklenmedik bir hata, şema haritasını
              istekte bulunan kişiye veriyordu.

              Program.cs'teki global işleyici üretimde zaten genel mesaj + traceId
              döndürüyor; bu blok tam olarak onu ATLIYORDU. Fırlatarak devrediyoruz:
              hata oraya düşer, traceId ile loglanır (admin panelden okunabilir) ve
              istemci yalnız genel mesajı görür.
            */
        }

        [HttpPost("bulk")]
        public async Task<IActionResult> CreateTasks([FromBody] TaskRequestDto taskRequest)
        {
            if (taskRequest?.Tasks == null || !taskRequest.Tasks.Any())
                return BadRequest("Invalid request body.");

            if (taskRequest.Tasks.Count > 200)
                return BadRequest("Maximum 200 tasks per bulk request.");

            var userId = GetUserId();
            if (userId == null)
                return Unauthorized();

            var taskItems = taskRequest.Tasks.Select(t => new TaskItem
            {
                Title = t.Title,
                Description = t.Description,
                DueDate = t.DueDate,
                DueTime = t.DueTime,
                IsCompleted = t.IsCompleted,
                Priority = t.Priority,
                Tags = t.Tags
            }).ToList();

            var success = await _taskService.CreateTasksBulkAsync(userId.Value, taskItems);
            return success ? Ok("Tasks created.") : StatusCode(500, "Error creating tasks.");
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] TaskItem updatedTask)
        {
            System.IO.File.AppendAllText("update_log.txt", $"[{DateTime.UtcNow}] UpdateTask called for {id} with DueDate: {updatedTask.DueDate}, Title: {updatedTask.Title}\n");
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized();

            var task = await _taskService.UpdateTaskAsync(userId.Value, id, updatedTask);
            if (task == null)
                return NotFound();

            return Ok(new { message = "Task updated successfully.", task });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized();

            var success = await _taskService.DeleteTaskAsync(userId.Value, id);
            return success ? NoContent() : NotFound();
        }

        [HttpPost("reorder")]
        public async Task<IActionResult> ReorderTasks([FromBody] List<int> orderedIds)
        {
            var userId = GetUserId();
            if (userId == null)
                return Unauthorized();

            if (orderedIds == null || !orderedIds.Any())
                return BadRequest("Invalid request body.");

            var success = await _taskService.ReorderTasksAsync(userId.Value, orderedIds);
            return success ? Ok("Tasks reordered successfully.") : BadRequest("Failed to reorder tasks.");
        }
    }
}