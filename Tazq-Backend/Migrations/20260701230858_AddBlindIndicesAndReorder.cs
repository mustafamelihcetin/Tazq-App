using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tazq_Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddBlindIndicesAndReorder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "Tasks",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(150)",
                oldMaxLength: 150);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Tasks",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AddColumn<string>(
                name: "TagsBlindIndex",
                table: "Tasks",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TitleBlindIndex",
                table: "Tasks",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_UserId_TagsBlindIndex",
                table: "Tasks",
                columns: new[] { "UserId", "TagsBlindIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_Tasks_UserId_TitleBlindIndex",
                table: "Tasks",
                columns: new[] { "UserId", "TitleBlindIndex" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tasks_UserId_TagsBlindIndex",
                table: "Tasks");

            migrationBuilder.DropIndex(
                name: "IX_Tasks_UserId_TitleBlindIndex",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "TagsBlindIndex",
                table: "Tasks");

            migrationBuilder.DropColumn(
                name: "TitleBlindIndex",
                table: "Tasks");

            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "Tasks",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Tasks",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");
        }
    }
}
