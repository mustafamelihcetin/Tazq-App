using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tazq_Backend.Migrations
{
    /// <inheritdoc />
    public partial class PaymentSkippedCycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LastSkippedCycleKey",
                table: "Payments",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastSkippedCycleKey",
                table: "Payments");
        }
    }
}
