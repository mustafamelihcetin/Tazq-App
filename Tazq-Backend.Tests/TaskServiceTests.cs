using Microsoft.EntityFrameworkCore;
using Moq;
using Tazq_App.Data;
using Tazq_App.Models;
using Tazq_App.Services;

namespace Tazq_Backend.Tests
{
    public class TaskServiceTests
    {
        private readonly AppDbContext _context;
        private readonly Mock<ICryptoService> _cryptoMock;
        private readonly TaskService _taskService;
        private readonly byte[] _mockKey = new byte[32];

        public TaskServiceTests()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new AppDbContext(options);

            _cryptoMock = new Mock<ICryptoService>();
            
            // Mock encryption behavior: return Base64 encoded "enc_" + value
            _cryptoMock.Setup(c => c.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("enc_" + (val ?? string.Empty))));
            
            // Mock decryption behavior: decode Base64 and strip "enc_" prefix
            _cryptoMock.Setup(c => c.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => {
                    if (string.IsNullOrEmpty(val)) return string.Empty;
                    try
                    {
                        var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(val));
                        return decoded.StartsWith("enc_") ? decoded.Substring(4) : decoded;
                    }
                    catch
                    {
                        return val;
                    }
                });

            _cryptoMock.Setup(c => c.GetKeyForUser(It.IsAny<int>()))
                .Returns(_mockKey);

            _cryptoMock.Setup(c => c.ComputeBlindIndex(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val?.ToLowerInvariant() ?? string.Empty);

            _taskService = new TaskService(_context, _cryptoMock.Object, new Mock<Microsoft.Extensions.Logging.ILogger<TaskService>>().Object);
        }

        [Fact]
        public async Task CreateTaskAsync_ShouldEncryptDataBeforeSaving()
        {
            // Arrange
            var userId = 1;
            var task = new TaskItem
            {
                Title = "Test Task",
                Description = "Description",
                Tags = new List<string> { "tag1" }
            };

            // Act
            var result = await _taskService.CreateTaskAsync(userId, task);

            // Assert
            _context.Entry(result).State = EntityState.Detached; // Detach to force reload from DB
            var dbTask = await _context.Tasks.FindAsync(result.Id);
            Assert.NotNull(dbTask);
            var dbTitle = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(dbTask.Title));
            var dbDesc = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(dbTask.Description));
            Assert.StartsWith("enc_", dbTitle);
            Assert.StartsWith("enc_", dbDesc);
            Assert.Equal("Test Task", result.Title); // Result should be decrypted
        }

        [Fact]
        public async Task GetTasksAsync_ShouldReturnDecryptedTasks()
        {
            // Arrange
            var userId = 1;
            _context.Tasks.Add(new TaskItem 
            { 
                UserId = userId, 
                Title = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("enc_Task 1")), 
                Description = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("enc_Desc")), 
                TagsJson = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("enc_[\"tag1\"]")) 
            });
            await _context.SaveChangesAsync();

            // Act
            var (items, totalCount) = await _taskService.GetTasksAsync(userId, null, null, null, null, null, null);

            // Assert
            Assert.Single(items);
            Assert.Equal(1, totalCount);
            Assert.Equal("Task 1", items[0].Title);
            Assert.Equal("Desc", items[0].Description);
        }
    }
}
