# Tazq-App

**Tazq** is a full-stack cross-platform productivity application combining intelligent task management with a Pomodoro-style focus timer. Built with **ASP.NET Core 8.0** (Backend) and **React Native + Expo** (Frontend).

## Backend Features (ASP.NET Core 8.0)

- JWT authentication with secure PBKDF2-SHA256 password hashing
- Full task management (CRUD) with subtasks, tags, priority, recurrence, and sort order
- AI-powered task parsing from natural language via Groq LLM
- Focus session tracking with streak calculation and weekly stats
- Email notifications (reminders, weekly summaries, exports)
- Role-based access control (Admin/User)
- PostgreSQL + Entity Framework Core 9
- Rate limiting, Swagger docs, global error handling
- Task data encryption per user (AES)

## Frontend Features (React Native + Expo)

- Cross-platform: Android & iOS via EAS Build
- Expo Router file-based navigation
- Zustand state management with AsyncStorage persistence
- Animated UI with Moti + React Native Reanimated
- Dark / Light / System theme support
- Turkish and English localization (i18n-js)
- Focus timer with 15/25/50/90 min presets
- Drag-to-reorder tasks, swipe-to-delete
- AI task parsing from free text input
- Push notifications for task reminders

## Tech Stack

| Layer    | Technology                                      |
| -------- | ----------------------------------------------- |
| Backend  | ASP.NET Core 8.0, EF Core 9, PostgreSQL 17      |
| Frontend | React Native 0.83, Expo 55, Zustand, NativeWind |
| Auth     | JWT Bearer, PBKDF2-SHA256                       |
| AI       | Groq API (llama-3.1-8b-instant)                 |
| Email    | NETCore.MailKit / Gmail SMTP                    |
| Proxy    | Caddy 2                                         |
| Container| Docker + Docker Compose                         |
| Build    | EAS (Expo Application Services)                 |

## Running Locally

**Backend:**

```bash
cp .env.example .env   # Fill in your credentials
docker compose up --build
```

**Frontend:**

```bash
cd Tazq-Frontend
npm install
EXPO_PUBLIC_API_URL=http://<your-ip>:5200 npx expo start
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Never commit `.env` to version control.
