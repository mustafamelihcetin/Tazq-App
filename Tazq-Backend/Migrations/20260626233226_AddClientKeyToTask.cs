using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tazq_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddClientKeyToTask : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOT: Yalnızca Tasks.ClientKey kolonu + idempotency index'i eklenir.
            // EF'in scaffold ettiği ilgisiz Tasks.Title/Description daraltmaları ve
            // PasswordResetTokens.Token / FocusSessions.StartedAt index'leri bilinçli
            // olarak çıkarıldı (Preferences migration'ındaki aynı drift; veri kaybı
            // riski + ayrı migration konusu).
            migrationBuilder.AddColumn<string>(
                name: "ClientKey",
                table: "Tasks",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_UserId_ClientKey",
                table: "Tasks",
                columns: new[] { "UserId", "ClientKey" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tasks_UserId_ClientKey",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "ClientKey",
                table: "Tasks");
        }
    }
}
