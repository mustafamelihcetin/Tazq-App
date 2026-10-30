using Microsoft.AspNetCore.Authorization;
using Tazq_App.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_App.Controllers
{
	[Route("api/[controller]")]
	[ApiController]
	[Authorize]
	public class SupportController : ControllerBase
	{
		private readonly ISupportService _support;
		private readonly ILogger<SupportController> _logger;
		private readonly IBackgroundTaskQueue _emailQueue;
		private readonly ISupportTemplateService _templates;

		// Veri erişimi ISupportService'te; mailler kuyruk üzerinden (kuyruk kendi
		// scope'unu açar). Controller yalnızca HTTP ile ilgilenir.
		public SupportController(ISupportService support, ILogger<SupportController> logger, IBackgroundTaskQueue emailQueue, ISupportTemplateService templates)
		{
			_support = support;
			_logger = logger;
			_emailQueue = emailQueue;
			_templates = templates;
		}

		// Hazır yanıt şablonları: destek ekibi okur, moderatör/süper admin düzenler.
		[HttpGet("admin/templates")]
		[Authorize(Policy = StaffPolicy.SupportDesk)]
		public async Task<IActionResult> GetTemplates() => Ok(new { templates = await _templates.GetAsync() });

		[HttpPut("admin/templates")]
		[Authorize(Policy = StaffPolicy.Moderation)]
		public async Task<IActionResult> SaveTemplates([FromBody] List<SupportTemplate>? templates)
		{
			var (saved, error) = await _templates.SaveAsync(templates);
			return saved == null ? BadRequest(new { message = error }) : Ok(new { templates = saved });
		}

		private int? GetUserId()
		{
			var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
			if (int.TryParse(claim, out int id)) return id;
			return null;
		}

		public class SendSupportDto
		{
			public string Message { get; set; } = string.Empty;
		}

		public class ReplySupportDto
		{
			public string Reply { get; set; } = string.Empty;
		}

		public class ReportCrashDto
		{
			public string ErrorMessage { get; set; } = string.Empty;
			public string StackTrace { get; set; } = string.Empty;
			public string DeviceName { get; set; } = string.Empty;
			public string Platform { get; set; } = string.Empty;
			public string AppVersion { get; set; } = string.Empty;
		}

		/*
		  ÇÖKME RAPORU — ANONİM ve SINIRSIZ bir yazma yoluydu.

		  Bu uç `[AllowAnonymous]`: kimlik doğrulaması olmadan çağrılabiliyor. Alanların
		  hiçbirinde uzunluk sınırı yoktu ve gelen yığın izi hem veritabanına hem de
		  `LogError` ile LOG DOSYASINA olduğu gibi yazılıyordu.

		  Asıl tehlike veritabanı değil, log tarafı: yeterince büyük ve yeterince sık
		  gönderim diski doldurur, disk dolunca da PostgreSQL dahil sunucudaki her şey
		  durur. Yani tek başına bu uç, kimlik doğrulaması gerektirmeyen bir servis
		  dışı bırakma yoluydu.

		  Kırpma sessiz ve bilinçli: çökme raporunu REDDETMEK, tam da görünürlüğe en çok
		  ihtiyaç duyulan anda (kötü bir sürümde) veri kaybettirir. 8 KB yığın izi gerçek
		  bir çökmeyi teşhis etmeye fazlasıyla yeter.
		*/
		private static string Clamp(string? value, int max, string fallback = "")
		{
			if (string.IsNullOrWhiteSpace(value)) return fallback;
			var v = value.Trim();
			return v.Length <= max ? v : v[..max];
		}

		private const int MaxErrorMessageLength = 500;
		private const int MaxStackTraceLength = 8_000;
		private const int MaxDeviceNameLength = 100;
		private const int MaxPlatformLength = 50;
		private const int MaxAppVersionLength = 20;

		// POST: api/support/report-crash (Public / AllowAnonymous)
		[HttpPost("report-crash")]
		[AllowAnonymous]
		public async Task<IActionResult> ReportCrash([FromBody] ReportCrashDto dto)
		{
			var crash = await _support.ReportCrashAsync(new ClientCrash
			{
				ErrorMessage = Clamp(dto.ErrorMessage, MaxErrorMessageLength, "Unknown Error"),
				StackTrace = Clamp(dto.StackTrace, MaxStackTraceLength),
				DeviceName = Clamp(dto.DeviceName, MaxDeviceNameLength, "Unknown Device"),
				Platform = Clamp(dto.Platform, MaxPlatformLength, "Unknown Platform"),
				AppVersion = Clamp(dto.AppVersion, MaxAppVersionLength, "1.0.0"),
				CreatedAt = DateTime.UtcNow,
			}, GetUserId());

			_logger.LogError("CLIENT CRASH [{Platform} - {DeviceName} - v{AppVersion}]: {ErrorMessage}\nStack: {StackTrace}",
				crash.Platform, crash.DeviceName, crash.AppVersion, crash.ErrorMessage, crash.StackTrace);

			return Ok(new { success = true, id = crash.Id });
		}

		// GET: api/support/admin/crashes (Sadece Admin)
		[HttpGet("admin/crashes")]
		[Authorize(Policy = StaffPolicy.SuperAdmin)]
		public async Task<IActionResult> GetCrashes(
			[FromQuery] int limit = 20,
			[FromQuery] int offset = 0,
			[FromQuery] bool unresolvedOnly = false)
		{
			var (items, total) = await _support.GetCrashesPageAsync(limit, offset, unresolvedOnly);
			return Ok(new
			{
				crashes = items,
				total,
				offset,
				limit,
				hasMore = offset + items.Count < total,
			});
		}

		// GET: api/support/admin/crash-groups — hata başına tek satır (bkz. CrashLog)
		[HttpGet("admin/crash-groups")]
		[Authorize(Policy = StaffPolicy.SuperAdmin)]
		public async Task<IActionResult> GetCrashGroups([FromServices] Tazq_App.Data.AppDbContext db,
			[FromQuery] int limit = 15, [FromQuery] int offset = 0, [FromQuery] bool unresolvedOnly = true)
		{
			var (groups, total, latest) = await CrashLog.GroupsPageAsync(db, limit, offset, unresolvedOnly);
			var byId = latest.ToDictionary(c => c.Id);
			return Ok(new
			{
				groups = groups.Select(g =>
				{
					byId.TryGetValue(g.LatestId, out var c);
					return new
					{
						errorMessage = g.ErrorMessage, count = g.Count, unresolved = g.Unresolved, firstAt = g.FirstAt, lastAt = g.LastAt,
						latest = c == null ? null : new { c.Id, c.StackTrace, c.DeviceName, c.Platform, c.AppVersion, c.UserEmail, c.CreatedAt },
					};
				}),
				total, offset, limit,
				hasMore = offset + groups.Count < total,
				retentionDays = new { resolved = (int)CrashLog.ResolvedRetention.TotalDays, max = (int)CrashLog.MaxRetention.TotalDays },
			});
		}

		public class ResolveGroupDto { public string ErrorMessage { get; set; } = string.Empty; }

		// PATCH: api/support/admin/crash-groups/resolve — aynı hatanın bütün kayıtları çözüldü
		[HttpPatch("admin/crash-groups/resolve")]
		[Authorize(Policy = StaffPolicy.SuperAdmin)]
		public async Task<IActionResult> ResolveCrashGroup([FromServices] Tazq_App.Data.AppDbContext db, [FromBody] ResolveGroupDto dto)
			=> Ok(new { resolved = await CrashLog.ResolveGroupAsync(db, dto.ErrorMessage ?? string.Empty) });

		// PATCH: api/support/admin/crashes/{id}/resolve (Sadece Admin)
		[HttpPatch("admin/crashes/{id}/resolve")]
		[Authorize(Policy = StaffPolicy.SuperAdmin)]
		public async Task<IActionResult> ResolveCrash(int id)
		{
			if (!await _support.ResolveCrashAsync(id)) return NotFound();
			return Ok(new { success = true });
		}

		// POST: api/support
		[HttpPost]
		public async Task<IActionResult> SendMessage([FromBody] SendSupportDto dto)
		{
			if (string.IsNullOrWhiteSpace(dto.Message))
				return BadRequest(new { message = "Mesaj boş olamaz." });

			var userId = GetUserId();
			if (userId == null) return Unauthorized();

			var supportMsg = await _support.CreateMessageAsync(userId.Value, dto.Message);
			if (supportMsg == null) return NotFound(new { message = "Kullanıcı bulunamadı." });

			var (email, name, message) = (supportMsg.UserEmail, supportMsg.UserName, supportMsg.Message);
			_emailQueue.Enqueue((sp, ct) =>
				sp.GetRequiredService<ICustomEmailService>()
				  .SendSupportConfirmationEmailAsync(email, name, message));

			return Ok(new { success = true, id = supportMsg.Id });
		}

		// Konuşmanın istemciye giden biçimi (iki taraf aynı şekli okur). Eski alanlar (adminReply,
		// repliedAt) eski uygulama sürümleri için korunur.
		private static object ThreadDto(SupportMessage m) => new
		{
			m.Id, m.Message, m.CreatedAt, m.AdminReply, m.RepliedAt,
			thread = SupportService.ThreadOf(m).Select(e => new { fromStaff = e.FromStaff, body = e.Body, at = e.At }),
			lastActivityAt = m.LastActivityAt ?? m.CreatedAt,
			closedAt = m.ClosedAt,
			closedBy = m.ClosedBy,
			canReply = SupportService.CanUserReply(m),
		};

		// GET: api/support/mine — kullanıcının KENDİ konuşmaları
		[HttpGet("mine")]
		public async Task<IActionResult> GetMyMessages()
		{
			var userId = GetUserId();
			if (userId == null) return Unauthorized();

			var messages = (await _support.GetMessagesForUserAsync(userId.Value)).Select(ThreadDto);
			return Ok(new { messages });
		}

		// POST: api/support/{id}/reply — kullanıcı kendi konuşmasına yazar
		[HttpPost("{id:int}/reply")]
		public async Task<IActionResult> UserReply(int id, [FromBody] SendSupportDto dto)
		{
			if (string.IsNullOrWhiteSpace(dto.Message))
				return BadRequest(new { message = "Mesaj boş olamaz." });
			var userId = GetUserId();
			if (userId == null) return Unauthorized();

			var (outcome, msg) = await _support.UserReplyAsync(userId.Value, id, dto.Message);
			return outcome switch
			{
				UserReplyOutcome.Ok => Ok(ThreadDto(msg!)),
				UserReplyOutcome.Closed => Conflict(new { code = "closed", message = "Bu konuşma kapatıldı. Yeni bir mesajla yazabilirsin." }),
				UserReplyOutcome.WaitForStaff => Conflict(new { code = "wait", message = "Yanıtımızı bekle — en kısa sürede döneceğiz." }),
				_ => NotFound(),
			};
		}

		// POST: api/support/{id}/close — kullanıcı kendi konuşmasını kapatır
		[HttpPost("{id:int}/close")]
		public async Task<IActionResult> UserClose(int id)
		{
			var userId = GetUserId();
			if (userId == null) return Unauthorized();
			return await _support.CloseAsync(id, byStaff: false, userId.Value) ? Ok(new { success = true }) : NotFound();
		}

		// PATCH: api/support/admin/{id}/close — ekip konuşmayı kapatır
		[HttpPatch("admin/{id}/close")]
		[Authorize(Policy = StaffPolicy.SupportDesk)]
		public async Task<IActionResult> StaffClose(int id) =>
			await _support.CloseAsync(id, byStaff: true) ? Ok(new { success = true }) : NotFound();

		// PATCH: api/support/admin/{id}/reply (Sadece Admin) — kullanıcının mesajına yanıt yaz
		[HttpPatch("admin/{id}/reply")]
		[Authorize(Policy = StaffPolicy.SupportDesk)]
		public async Task<IActionResult> ReplyMessage(int id, [FromBody] ReplySupportDto dto)
		{
			if (string.IsNullOrWhiteSpace(dto.Reply))
				return BadRequest(new { message = "Yanıt boş olamaz." });

			var msg = await _support.ReplyAsync(id, dto.Reply, GetUserId());
			if (msg == null) return NotFound(new { message = "Konuşma bulunamadı ya da kapatılmış." });

			// E-postada alıntılanan: kullanıcının SON mesajı (konuşmada ilk mesaj artık eski olabilir).
			var lastUser = SupportService.ThreadOf(msg).LastOrDefault(e => !e.FromStaff)?.Body ?? msg.Message;
			var (replyEmail, replyName, replyMessage, adminReply) = (msg.UserEmail, msg.UserName, lastUser, msg.AdminReply ?? string.Empty);
			_emailQueue.Enqueue((sp, ct) =>
				sp.GetRequiredService<ICustomEmailService>()
				  .SendSupportReplyEmailAsync(replyEmail, replyName, replyMessage, adminReply));

			return Ok(new { success = true, repliedAt = msg.RepliedAt, conversation = ThreadDto(msg) });
		}

		// GET: api/support/admin/all (Sadece Admin)
		[HttpGet("admin/all")]
		[Authorize(Policy = StaffPolicy.SupportDesk)]
		public async Task<IActionResult> GetAllMessages()
		{
			var all = await _support.GetAllMessagesAsync();
			var unreadCount = all.Count(m => !m.IsRead);
			// Varlık doğrudan dönmez (Replies → SupportMessage döngüsü); ekip alanları + konuşma.
			var messages = all.Select(m => new
			{
				m.Id, m.UserId, m.UserName, m.UserEmail, m.Message, m.CreatedAt, m.IsRead, m.AdminReply, m.RepliedAt,
				thread = SupportService.ThreadOf(m).Select(e => new { fromStaff = e.FromStaff, body = e.Body, at = e.At }),
				lastActivityAt = m.LastActivityAt ?? m.CreatedAt,
				closedAt = m.ClosedAt,
				closedBy = m.ClosedBy,
			});
			return Ok(new { messages, unreadCount });
		}

		// PATCH: api/support/admin/{id}/read (Sadece Admin)
		[HttpPatch("admin/{id}/read")]
		[Authorize(Policy = StaffPolicy.SupportDesk)]
		public async Task<IActionResult> MarkAsRead(int id)
		{
			if (!await _support.MarkAsReadAsync(id)) return NotFound();
			return Ok(new { success = true });
		}

		// DELETE: api/support/admin/{id} (Sadece Admin)
		[HttpDelete("admin/{id}")]
		[Authorize(Policy = StaffPolicy.Moderation)]
		public async Task<IActionResult> DeleteMessage(int id)
		{
			if (!await _support.DeleteMessageAsync(id)) return NotFound();
			return Ok(new { success = true });
		}
	}
}
