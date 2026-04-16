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
            
            // Mock encryption behavior: return "encrypted_" + value
            _cryptoMock.Setup(c => c.Encrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => "enc_" + val);
            
            // Mock decryption behavior: strip "encrypted_" prefix
            _cryptoMock.Setup(c => c.Decrypt(It.IsAny<string>(), It.IsAny<byte[]>()))
                .Returns((string val, byte[] k) => val.StartsWith("enc_") ? val.Substring(4) : val);

            _cryptoMock.Setup(c => c.GetKeyForUser(It.IsAny<int>()))
                .Returns(_mockKey);

            _taskService = new TaskService(_context, _cryptoMock.Object);
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
            Assert.StartsWith("enc_", dbTask.Title);
            Assert.StartsWith("enc_", dbTask.Description);
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
                Title = "enc_Task 1", 
                Description = "enc_Desc", 
                TagsJson = "enc_[\"tag1\"]" 
            });
            await _context.SaveChangesAsync();

            // Act
            var tasks = await _taskService.GetTasksAsync(userId, null, null, null, null, null, null);

            // Assert
            Assert.Single(tasks);
            Assert.Equal("Task 1", tasks[0].Title);
            Assert.Equal("Desc", tasks[0].Description);
        }
    }
}
