# HudumaHub Backend

A production-ready Node.js/TypeScript backend for HudumaHub with authentication, services management, and order processing.

## Features

- **Authentication**: JWT-based auth with access/refresh tokens, password reset
- **User Roles**: Admin and Provider roles (customers place anonymous orders)
- **Services**: CRUD operations for services with provider ownership
- **Orders**: Authenticated and anonymous order creation
- **Security**: Rate limiting, input validation, bcrypt hashing, helmet, CORS
- **Database**: MySQL with parameterized queries

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hudumahub

# JWT
JWT_SECRET=your_super_secret_jwt_key_here

# Email (optional for development)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@hudumahub.com

# Frontend
FRONTEND_URL=http://localhost:4000

# Environment
NODE_ENV=development
```

## Setup Instructions

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Database Setup

Ensure MySQL is running and create the database:

```sql
CREATE DATABASE hudumahub;
```

Run the migration script:

```bash
mysql -u root -p hudumahub < migrations/001_initial_schema.sql
```

### 3. Seed Admin User

```bash
pnpm run seed:admin
```

This creates an admin user with email `admin@hudumahub.com` and password `ChangeThisPassword123!`. **Change the password immediately after first login!**

### 4. Start Development Server

```bash
pnpm run dev
```

The server will start on `http://localhost:4000`.

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Provider registration
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/update-password` - Update password
- `POST /api/auth/reset-password` - Request password reset
- `POST /api/auth/reset-password/confirm` - Confirm password reset

### Services

- `GET /api/services` - List all services
- `GET /api/services/:slug` - Get service by slug
- `POST /api/services` - Create servicea (provider)
- `PUT /api/services/:id` - Update service (provider, own services)
- `DELETE /api/services/:id` - Delete service (provider, own services)
- `GET /api/services/provider/me` - Get provider's services

### Orders

- `POST /api/orders/anonymous` - Create anonymous order
- `POST /api/orders` - Create authenticated order
- `GET /api/orders/my` - Get user's orders
- `GET /api/orders` - Get all orders (admin)
- `PUT /api/orders/:id/status` - Update order status (admin)
- `PUT /api/orders/:id/payment` - Update payment status (admin)

### Users (Admin Only)

- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Testing with Postman

1. Import `postman/HudumaHub_API.postman_collection.json` into Postman
2. Update the `base_url` variable to match your server URL
3. Run the auth flow:
   - Sign in as admin
   - Use the returned tokens for authenticated requests
   - Create a service
   - Place an anonymous order

## Security Notes

### JWT Tokens

- Access tokens: 15 minutes expiry
- Refresh tokens: 7 days expiry, stored hashed in DB with rotation
- Tokens are rotated on refresh for security

### Rate Limiting

- Auth endpoints: 5 requests per 15 minutes per IP
- Anonymous orders: 3 requests per hour per IP
- Global: 100 requests per 15 minutes per IP

### Password Security

- Passwords hashed with bcrypt (12 rounds)
- Minimum 6 characters required
- Password reset tokens expire in 15 minutes

### Production Considerations

- **HTTPS Required**: Always use HTTPS in production
- **CSRF Protection**: Implement CSRF tokens if using cookies for tokens
- **Database Backups**: Regular backups of user data and orders
- **Connection Pooling**: Adjust MySQL pool size based on load
- **Logging**: Implement comprehensive logging for security events
- **Email Queue**: Use a queue system (Redis, Bull) for email sending in production
- **Token Expiry**: Consider shorter token expiries in high-security environments

### Admin Creation

- Admin users cannot be created via public API
- Use the seed script for initial admin setup
- Additional admins can be created by existing admins via `/api/users` endpoint

## Development

### Project Structure

```
src/
├── config/db.ts          # Database configuration
├── controllers/          # Request handlers
├── middleware/           # Express middleware
├── routes/               # API routes
├── utils/                # Utility functions
└── index.ts              # Application entry point
```

### Scripts

- `pnpm run dev` - Start development server with hot reload
- `pnpm run build` - Build for production
- `pnpm run start` - Start production server
- `pnpm run seed:admin` - Seed initial admin user

## Optional: Jest Tests

Basic test stubs are provided in `tests/` directory. Run tests with:

```bash
pnpm test
```

Tests include stubs for:

- Authentication endpoints
- Order creation
- Service management
