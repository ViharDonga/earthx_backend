# EarthX Backend (NestJS + MySQL + JWT Authentication)

A secure and modular backend API built with **NestJS**, **TypeORM**, **MySQL**, and **JWT Authentication**.

---

## 🛠 Features

- **Framework**: NestJS (TypeScript)
- **Database**: MySQL with TypeORM
- **Authentication**: JWT token with Passport Strategy
- **Password Security**: Bcrypt hashing
- **Validation**: Class Validator & Class Transformer
- **CORS**: Configured for Angular frontend

---

## 📁 Project Structure

```
earthx-backend/
├── src/
│   ├── auth/
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   └── register.dto.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── users/
│   │   ├── dto/
│   │   │   └── create-user.dto.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   ├── app.module.ts
│   └── main.ts
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Configure Environment Variables

Edit `.env` (or copy from `.env.example`):

```env
PORT=3000

# Local MySQL Database (used during development)
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_local_mysql_password
DB_DATABASE=earthx_db
DB_SYNCHRONIZE=true

# Production Database (used by npm run db:sync to fetch real data)
PROD_DB_HOST=89.116.133.75
PROD_DB_PORT=3306
PROD_DB_USERNAME=your_prod_mysql_username
PROD_DB_PASSWORD=your_prod_mysql_password
PROD_DB_DATABASE=your_prod_mysql_database

JWT_SECRET=earthx_super_secret_jwt_key_2026_change_in_production
JWT_EXPIRES_IN=1d
```

### 2. Sync Production Data to Local Database (Optional / Testing)

To copy all tables and live data from your Production MySQL database into your local MySQL database for testing:

```bash
npm run db:sync
# or
npm run db:pull
```

> **Note**: This will create the local database if it doesn't exist, replicate all production tables, and copy all production rows into your local database.

### 3. Install Dependencies

```bash
cd earthx-backend
npm install
```

### 3. Run the Server

- **Development Mode (with live reload)**:
  ```bash
  npm run start:dev
  ```
- **Production Build**:
  ```bash
  npm run build
  npm run start:prod
  ```

---

## 📡 API Endpoints

All routes are prefixed with `/api`.

### 1. Register User
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/register`
- **Body** (`application/json`):
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password@123",
  "role": "user"
}
```
- **Response** (`201 Created`):
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "c1f7b0a8-...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2026-08-24T10:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2. Login
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/login`
- **Body** (`application/json`):
```json
{
  "email": "john@example.com",
  "password": "Password@123"
}
```
- **Response** (`200 OK`):
```json
{
  "message": "Login successful",
  "user": {
    "id": "c1f7b0a8-...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 3. Get Authenticated User Profile (Protected)
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/auth/profile`
- **Header**:
  ```
  Authorization: Bearer <your_jwt_access_token>
  ```
- **Response** (`200 OK`):
```json
{
  "message": "Profile retrieved successfully",
  "user": {
    "id": "c1f7b0a8-...",
    "email": "john@example.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

---

### 4. Health / Service Status Check
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/auth/status`
- **Response** (`200 OK`):
```json
{
  "status": "ok",
  "timestamp": "2026-08-24T10:00:00.000Z",
  "service": "EarthX Authentication Service"
}
```
