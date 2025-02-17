using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tazq_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddTagsToTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tasks_Users_AssignedByUserId",
                table: "Tasks");

            migrationBuilder.DropIndex(
                name: "IX_Tasks_AssignedByUserId",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "AssignedByUserId",
                table: "Tasks");

            migrationBuilder.AddColumn<string>(
                name: "Tags",
                table: "Tasks",
                type: "TEXT",
                nullable: false,
                defaultValue: "[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Tags",
                table: "Tasks");

            migrationBuilder.AddColumn<int>(
                name: "AssignedByUserId",
                table: "Tasks",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_AssignedByUserId",
                table: "Tasks",
                column: "AssignedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tasks_Users_AssignedByUserId",
                table: "Tasks",
                column: "AssignedByUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }
    }
}
