using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tazq_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddUserCreatedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: false,
                // Sütun eklenmeden önceki satırlar için sabit bir "bilinmiyor" damgası.
                // now() kullanılsaydı tüm eski kullanıcılar migration gününde kayıt olmuş
                // görünür ve o günün admin özeti sahte bir patlama raporlardı.
                defaultValueSql: "timestamptz '2000-01-01 00:00:00+00'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Users");
        }
    }
}
