using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Tazq_App.Models
{
	public class SupportMessage
	{
		[Key]
		public int Id { get; set; }

		public int UserId { get; set; }

		[Required]
		public string UserName { get; set; } = string.Empty;

		[Required]
		public string UserEmail { get; set; } = string.Empty;

		[Required]
		public string Message { get; set; } = string.Empty;

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

		public bool IsRead { get; set; } = false;

		// SON ekip yanıtı. 2026-10-31'den beri asıl kayıt Replies (konuşma); bu alan ESKİ uygulama
		// sürümleri tek yanıt okuduğu için son ekip yanıtıyla güncel tutulur. Boşsa henüz yanıt yok.
		public string? AdminReply { get; set; }

		public DateTime? RepliedAt { get; set; }

		/// <summary>Konuşmanın devamı (ilk mesaj = Message). Bkz. SupportService.ThreadOf.</summary>
		public List<SupportReply> Replies { get; set; } = new();

		/// <summary>Son hareket (mesaj/yanıt) — kutu sıralaması. Null = yalnız ilk mesaj (CreatedAt).</summary>
		public DateTime? LastActivityAt { get; set; }

		/// <summary>Konuşma kapatıldı: iki taraf da kapatabilir; kapalı konuşmaya yanıt yazılmaz.</summary>
		public DateTime? ClosedAt { get; set; }

		/// <summary>"user" | "staff" — kimin kapattığı (konuşmada gösterilir).</summary>
		public string? ClosedBy { get; set; }
	}

	/// <summary>Destek konuşmasında ilk mesajdan sonraki her mesaj (kullanıcı ya da ekip).</summary>
	public class SupportReply
	{
		[Key]
		public int Id { get; set; }

		public int SupportMessageId { get; set; }
		public SupportMessage? SupportMessage { get; set; }

		public bool FromStaff { get; set; }

		/// <summary>Yazan hesap (ekip yanıtında yanıtlayan yetkili). Kişisel veri yanıtta dönmez.</summary>
		public int? AuthorUserId { get; set; }

		[Required]
		public string Body { get; set; } = string.Empty;

		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	}
}
