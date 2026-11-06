using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tazq_Backend.Migrations
{
    /// <inheritdoc />
    public partial class TaskClientKeyUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Var olan çift açık görevler silinmez: en eskisi anahtarı korur, diğerleri anahtarsız kalır.
            migrationBuilder.Sql(@"
                UPDATE ""Tasks"" t SET ""ClientKey"" = NULL
                WHERE t.""ClientKey"" IS NOT NULL AND NOT t.""IsCompleted""
                  AND EXISTS (SELECT 1 FROM ""Tasks"" o
                              WHERE o.""UserId"" = t.""UserId"" AND o.""ClientKey"" = t.""ClientKey""
                                AND NOT o.""IsCompleted"" AND o.""Id"" < t.""Id"");");

            migrationBuilder.DropIndex(
                name: "IX_Tasks_UserId_ClientKey",
                table: "Tasks");

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_UserId_ClientKey",
                table: "Tasks",
                columns: new[] { "UserId", "ClientKey" },
                unique: true,
                filter: "\"ClientKey\" IS NOT NULL AND NOT \"IsCompleted\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tasks_UserId_ClientKey",
                table: "Tasks");

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_UserId_ClientKey",
                table: "Tasks",
                columns: new[] { "UserId", "ClientKey" });
        }
    }
}
