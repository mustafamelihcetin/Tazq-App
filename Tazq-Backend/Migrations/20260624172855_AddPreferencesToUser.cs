using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tazq_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPreferencesToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOT: Yalnızca Users.Preferences kolonu eklenir. EF tarafından scaffold edilen
            // ilgisiz Tasks.Title/Description daraltmaları ve index'ler bilinçli olarak çıkarıldı
            // (mevcut başlıkları kesip veri kaybına yol açabilir). O model/snapshot drift'i
            // ayrı bir migration ile ele alınmalıdır.
            migrationBuilder.AddColumn<string>(
                name: "Preferences",
                table: "Users",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Preferences",
                table: "Users");
        }
    }
}
