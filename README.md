# 🎓 School Social App - Backend

A complete NestJS backend for a school social app with authentication, OTP verification, and student onboarding.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **Auth** | Email/password signup with bcrypt hashing |
| 📧 **OTP Verification** | 6-digit email OTP with 10-min expiry |
| 📝 **Onboarding** | Multi-step profile setup with file uploads |
| 🏫 **Schools** | Pre-seeded Nigerian universities |
| 📱 **JWT Auth** | Access + refresh tokens with guards |
| 📊 **Swagger Docs** | Auto-generated API documentation |
| 🐳 **Docker** | Full containerization with PostgreSQL |
| 🛡️ **Security** | Helmet, rate limiting, CORS, validation |

## 🚀 Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Setup

```bash
# Extract the project
cd school-social-app-backend

# Copy environment file
cp .env.example .env

# Edit .env with your SMTP credentials for OTP emails
# (Use Gmail App Password or any SMTP provider)
```

### 2. Start with Docker

```bash
# Start all services
docker-compose up --build

# Or in background
docker-compose up -d --build
```

### 3. Seed Schools

```bash
# In another terminal, seed the schools data
docker exec -it school-social-app npm run seed:schools
```

### 4. Access

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api/docs |
| Adminer (DB) | http://localhost:8080 |

## 📡 API Flow

### 1. Sign Up
```http
POST /v1/auth/signup
Content-Type: application/json

{
  "email": "student@unilag.edu.ng",
  "password": "SecurePass123!"
}
```
**Response:** `Account created. OTP sent to email.`

### 2. Verify OTP
```http
POST /v1/auth/verify-otp
Content-Type: application/json

{
  "email": "student@unilag.edu.ng",
  "code": "123456"
}
```
**Response:** `Email verified. Please complete onboarding.`

### 3. Login
```http
POST /v1/auth/login
Content-Type: application/json

{
  "email": "student@unilag.edu.ng",
  "password": "SecurePass123!"
}
```
**Response:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "user": { ... },
  "onboardingRequired": true,
  "onboardingStep": "email_verified"
}
```

### 4. Complete Onboarding
```http
POST /v1/auth/onboarding
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

firstName: John
lastName: Doe
dateOfBirth: 2000-05-15
gender: male
schoolId: <school-uuid>
faculty: Engineering
department: Computer Science
matricNumber: ENG/2020/001
jambNumber: 12345678AB
username: johndoe2024
phoneNumber: +2348012345678
termsAccepted: true
profilePicture: [file]
schoolIdCard: [file]
```

### 5. Check Onboarding Status
```http
GET /v1/auth/onboarding-status
Authorization: Bearer <access_token>
```

## 📁 Project Structure

```
src/
├── auth/
│   ├── auth.controller.ts      # Auth endpoints
│   ├── auth.module.ts
│   ├── auth.service.ts         # Signup, login, onboarding logic
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   └── strategies/
│       └── jwt.strategy.ts
├── users/
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── login.dto.ts
│   │   ├── onboarding.dto.ts
│   │   ├── update-profile.dto.ts
│   │   ├── verify-otp.dto.ts
│   │   └── resend-otp.dto.ts
│   ├── entities/
│   │   └── user.entity.ts
│   ├── users.controller.ts
│   ├── users.module.ts
│   └── users.service.ts
├── otp/
│   ├── entities/
│   │   └── otp.entity.ts
│   ├── otp.module.ts
│   └── otp.service.ts          # OTP generation & email
├── schools/
│   ├── entities/
│   │   └── school.entity.ts
│   ├── schools.controller.ts
│   ├── schools.module.ts
│   └── schools.service.ts
├── common/
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   └── pipes/
│       └── file-validation.pipe.ts
├── config/
│   ├── database.config.ts
│   └── typeorm.config.ts
├── app.module.ts
└── main.ts
```

## 🔐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `postgres` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | DB username | `postgres` |
| `DB_PASSWORD` | DB password | `postgres` |
| `DB_NAME` | Database name | `school_social_app` |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_REFRESH_SECRET` | Refresh token secret | - |
| `SMTP_HOST` | Email server host | `smtp.gmail.com` |
| `SMTP_USER` | Email username | - |
| `SMTP_PASS` | Email password/app password | - |
| `OTP_EXPIRY_MINUTES` | OTP validity | `10` |

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🛠️ Development (without Docker)

```bash
# 1. Start PostgreSQL locally
# 2. Install dependencies
npm install

# 3. Run migrations
npm run migration:run

# 4. Seed schools
npm run seed:schools

# 5. Start dev server
npm run start:dev
```

## 📜 License

MIT
# mrB
