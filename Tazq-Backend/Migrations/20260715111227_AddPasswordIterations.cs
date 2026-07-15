using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tazq_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordIterations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Yeni kayıtlar güncel maliyetle (600k) yazılır — sütun varsayılanı budur.
            migrationBuilder.AddColumn<int>(
                name: "PasswordIterations",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: Tazq_App.Models.PasswordHashDefaults.CurrentIterations);

            // KRİTİK: bu sütun eklenmeden önce var olan hash'ler 100k ile üretilmişti.
            // Onlara 600k yazmak doğrulamayı bozar ve mevcut TÜM kullanıcıları kilitler.
            // Eski satırlar gerçek maliyetleriyle işaretlenir; kullanıcı bir sonraki başarılı
            // girişinde sessizce 600k'ya taşınır (UserService.LoginAsync → NeedsRehash).
            migrationBuilder.Sql(
                $"UPDATE \"Users\" SET \"PasswordIterations\" = {Tazq_App.Models.PasswordHashDefaults.LegacyIterations};");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordIterations",
                table: "Users");
        }
    }
}
