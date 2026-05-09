# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**api-nairim-v2** is a TypeScript/Express.js REST API for managing real estate properties, leases, financial operations, and related entities. It uses PostgreSQL (via Prisma ORM) for persistence and includes JWT authentication, file uploads, image processing, and rate limiting.

## Development Commands

### Setup & Installation
```bash
npm install                    # Install dependencies
npm run prisma:generate        # Generate Prisma client from schema
npm run prisma:migrate         # Run pending database migrations
npm run prisma:seed            # Seed database with initial data
```

### Running the Server
```bash
npm run dev                    # Start development server with hot reload (tsx watch)
npm run build                  # Compile TypeScript to dist/
npm run start                  # Run compiled production build (node dist/server.js)
```

### Testing & Linting
```bash
npm test                       # Run all tests with Vitest
npm test -- src/path/file     # Run specific test file
npm test -- --ui              # Open Vitest UI
npm test -- --coverage        # Generate coverage report
```

Linting and formatting are configured but no explicit scripts are defined. Use your IDE's TypeScript/ESLint integration.

## Architecture

### Directory Structure
```
src/
├── app.ts                 # Express app setup (middleware, routes)
├── server.ts              # Entry point - starts server & connects DB
├── env.ts                 # Environment variable validation & export
├── controllers/           # Request handlers (request/response logic)
├── services/              # Business logic layer
├── routes/                # API route definitions
├── middlewares/           # Express middleware (auth, validation, error handling)
├── lib/                   # Shared libraries (prisma, logger, blob service)
├── utils/                 # Utility functions (API response helpers, validation)
├── types/                 # TypeScript type definitions
└── generated/prisma/      # Auto-generated Prisma client (do not edit)

prisma/
├── schema.prisma          # Database schema definition
├── migrations/            # Auto-generated migration files (do not edit)
└── seed.ts                # Database seeding script
```

### Key Layers

**Controllers** (e.g., `UserController.ts`): Handle HTTP requests/responses. Route handlers call controller methods.

**Services** (e.g., `UserService.ts`): Contain business logic. Controllers delegate domain operations to services, which interact with Prisma.

**Middlewares**: 
- `auth.ts`: JWT verification (`authenticateJWT`, `requireAdmin`, `requireSelfOrAdmin`)
- `validation.ts`: Request body/param validation
- `imageProcessing.ts`: File upload & image optimization with Sharp
- `authRateLimit.ts`: Rate limiting for auth endpoints
- `error.ts`: Global error handling

**Routes**: Each resource has a route file (e.g., `/routes/user.ts`, `/routes/property.ts`) that defines endpoints and applies middleware.

### Request Flow
1. Request → Express app (security headers via Helmet, CORS)
2. Rate limiting → Pino HTTP logging
3. Route matching → Middleware chain (auth, validation) → Controller
4. Controller → Service (business logic) → Prisma (database)
5. Response → Error handler (catches & normalizes errors) → JSON response

## Core Technologies

- **Express 5.x**: Web framework
- **TypeScript 5.x**: Type-safe development
- **Prisma 7.x**: ORM with PostgreSQL adapter
- **JWT (jsonwebtoken)**: Authentication token generation & verification
- **Pino + pino-http**: Structured logging (pretty-printed in dev)
- **Helmet**: Security headers (XSS, clickjacking, etc.)
- **CORS**: Cross-origin request handling
- **Sharp**: Image resizing/optimization on upload
- **Multer**: Multipart file upload handling
- **Vercel Blob / Local Storage**: File persistence (configurable via `USE_VERCEL_BLOB`)
- **Vitest**: Unit/integration testing
- **Supertest**: HTTP assertion library for tests

## Authentication & Authorization

**JWT Flow**:
1. Login endpoint (`/auth/login`) validates credentials, generates JWT signed with `JWT_SECRET`
2. Client stores token, sends in `Authorization: Bearer <token>` header
3. `authenticateJWT` middleware verifies signature & expiry, decodes payload onto `req.user`
4. Role-based middleware: `requireAdmin` (admin only), `requireSelfOrAdmin` (self or admin)

**Roles**: `'administrador'` or `'ADMIN'` (case-insensitive check in auth middleware)

## Environment Variables

**Required**:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Key for signing/verifying JWTs (use a strong random string in production)

**Optional**:
- `NODE_ENV`: `'development'` or `'production'` (defaults to development; affects logging)
- `PORT`: Server port (default: 5000)
- `BASE_URL`: Public API base URL (default: `http://localhost:5000`)
- `USE_VERCEL_BLOB`: Set to `'true'` to use Vercel Blob; otherwise uses local `/uploads` directory
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token (required if `USE_VERCEL_BLOB=true`)
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds (default: 5 min)
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 10,000)

**Example .env**:
```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://user:password@localhost:5432/nairim
JWT_SECRET=your-super-secret-key-change-in-production
BASE_URL=http://localhost:5000
USE_VERCEL_BLOB=false
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX_REQUESTS=10000
```

## Database

**Schema**: Defined in `prisma/schema.prisma`. Major models:
- **User**: System users (login, role-based access)
- **Agency**: Real estate agencies
- **Property**: Properties managed by agencies/owners
- **Owner**: Property owners
- **Tenant**: Lease tenants
- **Lease**: Lease agreements
- **PropertyIptu**: Property tax records
- **Financial models**: Categories, transactions, invoices, suppliers, cards, centers

**Workflow**:
1. Edit `schema.prisma`
2. Run `npm run prisma:migrate` (creates migration in `/prisma/migrations/`)
3. Prisma auto-regenerates client in `src/generated/prisma/`

Never manually edit files in `src/generated/prisma/` or `/prisma/migrations/`.

## File Uploads & Image Processing

**Upload Handling**:
- Middleware `imageProcessing.ts` uses Multer to accept multipart/form-data
- Images are resized/optimized with Sharp
- Destination: Vercel Blob (if `USE_VERCEL_BLOB=true`) or local `/uploads` directory
- Temp files cleaned on server startup

**Service Integration**: `BlobService` in `lib/blobService.ts` abstracts storage backend.

## API Response Format

All endpoints follow a consistent response structure (see `utils/api-response.ts`):

**Success**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error**:
```json
{
  "success": false,
  "message": "Error description"
}
```

## Validation

Validation logic is in `middlewares/validation.ts`. Typically applied per-route to validate request bodies and params before reaching controllers.

## Logging

**Development**: Pretty-printed via pino-pretty (colored, readable timestamps)  
**Production**: JSON structured logs (optimal for log aggregation services)

Format: `{method} {url} → {statusCode} ({responseTime}ms)`

Log with: `logger.info()`, `logger.error()`, etc. (imported from `lib/logger.ts`)

## Deployment Considerations

- Build: `npm run build` → compiles to `dist/`
- Start: `npm run start` → runs `node dist/server.js`
- Ensure `DATABASE_URL` and `JWT_SECRET` are set in production
- Set `NODE_ENV=production` for optimized logging
- Use environment-specific `.env` files or secrets manager (do not commit `.env`)
- Rate limiting defaults are aggressive (10k/5min); adjust for your scale

## Testing

Tests use **Vitest** + **Supertest** (HTTP assertions). Test files typically match source files (e.g., `UserController.test.ts` → `src/controllers/UserController.ts`).

Run specific test:
```bash
npm test -- src/controllers/UserController.test.ts
```

Mock Prisma client in tests to avoid DB dependencies.

## Common Patterns

**Add a new endpoint**:
1. Create controller method in `src/controllers/XyzController.ts`
2. Add service method in `src/services/XyzService.ts`
3. Define route in `src/routes/xyz.ts` (import controller, apply middleware)
4. Register route in `src/routes/index.ts`

**Add a database model**:
1. Define in `prisma/schema.prisma`
2. Run `npm run prisma:migrate`
3. Prisma client auto-regenerates
4. Use in services: `prisma.modelName.findUnique()`, etc.

**Protect an endpoint**:
```typescript
router.get('/admin-only', authenticateJWT, requireAdmin, controllerMethod);
```

## Build & Compilation

TypeScript is compiled with `tsc` and path aliases are resolved via `tsc-alias` (see build script). This allows imports like `import { env } from '@/env'` to work.

Source maps are generated for debugging. The `dist/` folder mirrors `src/` structure.
