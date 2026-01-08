This guide explains how to deploy the HudumaLynk backend to Coolify.

## Prerequisites

1. A Coolify instance (self-hosted or cloud)
2. A Git repository containing this backend code
3. A MySQL database (can be managed by Coolify or external)

## Coolify Deployment Steps

### 1. Connect Your Repository

1. In your Coolify dashboard, click "Add New Resource" → "Application"
2. Choose "Git Repository" as the source
3. Enter your repository URL and branch
4. Coolify will automatically detect the `coolify.json` configuration

### 2. Configure Environment Variables

Set the following environment variables in Coolify:

#### Required Variables

```
NODE_ENV=production
PORT=4000

# Database Configuration
DB_HOST=your_mysql_host
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=HudumaLynk

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# Frontend URL (where your React app will be hosted)
FRONTEND_URL=https://your-frontend-domain.com
```

#### Optional Variables (for Email)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=noreply@HudumaLynk.com
```

### 3. Database Setup

#### Option A: Using Coolify's Built-in Database

1. In Coolify, create a new MySQL database service
2. Note the connection details (host, user, password, database name)
3. Use these details in your environment variables

#### Option B: External Database

1. Set up your MySQL database externally (AWS RDS, PlanetScale, etc.)
2. Use the external connection details in environment variables

### 4. Run Database Migrations

After deployment, you need to run the database migrations:

1. Connect to your deployed container via Coolify's terminal
2. Run: `cd /app && node scripts/migrate.js`

### 5. Seed Admin User

Create the initial admin user:

1. In the container terminal, run: `cd /app && node scripts/seedAdmin.js`
2. Note the generated admin credentials from the logs

### 6. Configure Domains and SSL

1. In Coolify, configure your domain for the backend
2. Enable SSL/TLS for secure connections
3. Update your `FRONTEND_URL` environment variable if needed

## File Upload Configuration

The backend serves uploaded files from the `/uploads` endpoint. The `uploads` volume is automatically configured in `coolify.json` to persist file uploads between deployments.

## Health Checks

The application includes health checks that Coolify will use to monitor the service status. The health endpoint is `/api/health`.

## Troubleshooting

### Common Issues

1. **Database Connection Failed**

   - Verify DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
   - Ensure the database is accessible from your Coolify server

2. **Application Won't Start**

   - Check the logs in Coolify dashboard
   - Verify all required environment variables are set

3. **File Uploads Not Working**
   - Ensure the uploads volume is properly mounted
   - Check file permissions in the container

### Logs

Access application logs through the Coolify dashboard under your application → "Logs" tab.

## Production Considerations

1. **Environment Variables**: Never commit sensitive data to your repository
2. **Backups**: Configure regular database backups in Coolify
3. **Scaling**: Monitor resource usage and scale as needed
4. **Security**: Keep dependencies updated and monitor for vulnerabilities

## Updating Your Deployment

When you push changes to your repository:

1. Coolify will automatically detect the changes
2. Rebuild and redeploy the application
3. Run any necessary migrations if you've added new ones

## Frontend Integration

Once deployed, your backend will be accessible at your configured domain. Update your frontend's API base URL to point to this domain.

Example:

```
const API_BASE_URL = 'https://your-backend-domain.com/api';
```

=======

# HudumaLynk Backend Deployment Guide

This guide explains how to deploy the HudumaLynk backend to Coolify, starting with the FREE tier.

## 🚀 Quick Start with Coolify Free Tier

### Prerequisites

1. GitHub/GitLab repository with this code
2. Coolify Cloud account (free at https://coolify.io)
3. Free MySQL database (PlanetScale, Railway, or similar)

### Step 1: Sign Up for Coolify Cloud (Free)

1. Go to https://coolify.io
2. Sign up with GitHub/GitLab
3. Verify your email

### Step 2: Connect Your Repository

1. In Coolify dashboard, click **"Add New Resource"** → **"Application"**
2. Choose **"Git Repository"**
3. Connect your GitHub/GitLab account
4. Select your repository and branch (main/master)
5. Coolify will detect the `coolify.json` config automatically

### Step 3: Set Up Free Database

Use **PlanetScale** (free tier available):

1. Go to https://planetscale.com
2. Sign up (free)
3. Create a new database called `HudumaLynk`
4. Go to "Settings" → "Passwords" → "New password"
5. Create a password with name "coolify"
6. Copy the connection details

### Step 4: Configure Environment Variables

In Coolify, go to your app → "Environment Variables" and add:

**Required:**

```
NODE_ENV=production
DB_HOST=your_planetscale_host
DB_USER=your_planetscale_user
DB_PASSWORD=your_planetscale_password
DB_NAME=HudumaLynk
JWT_SECRET=your_random_secret_key_here_make_it_long_and_secure
FRONTEND_URL=https://HudumaLynk.vercel.app
```

**Optional (for email - can skip for now):**

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Step 5: Deploy

1. Click **"Deploy"** in Coolify
2. Wait for build to complete (5-10 minutes)
3. Your app will get a URL like: `https://HudumaLynk-backend-abc123.coolify.app`

### Step 6: Initialize Database

1. In Coolify, go to your app → "Terminal"
2. Run: `cd /app && node scripts/migrate.js`
3. Run: `cd /app && node scripts/seedAdmin.js`
4. Note the admin credentials from the output

### Step 7: Test Your API

Test these endpoints:

- `GET https://your-coolify-url.coolify.app/api/health`
- `POST https://your-coolify-url.coolify.app/api/auth/signin`

### Step 8: Update Frontend

In your Vercel frontend, update the API base URL to your Coolify URL:

```javascript
const API_BASE_URL = "https://your-coolify-url.coolify.app/api";
```

## 📋 Free Tier Limitations & Solutions

### Coolify Free Tier Limits:

- 1 application
- 512MB RAM, 1 vCPU
- 1GB storage
- No custom domains (uses \*.coolify.app)

### Solutions:

- **Custom Domain**: Upgrade to $5/month plan for custom domains
- **More Resources**: Upgrade when you need more power
- **Database**: PlanetScale free tier is sufficient for development

## 🔧 Troubleshooting Free Tier Setup

### Build Fails:

- Check Coolify logs for errors
- Ensure all required environment variables are set
- Verify database connection details

### Database Connection Issues:

- Double-check PlanetScale connection string
- Make sure database name is `HudumaLynk`
- Test connection from Coolify terminal: `mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME`

### CORS Issues:

- Ensure `FRONTEND_URL` is set to `https://HudumaLynk.vercel.app`
- Check browser console for CORS errors

## 💰 Upgrading from Free Tier

When ready to go production:

### $5/month Plan:

- Custom domains
- 3 applications
- 1GB RAM, 2 vCPU
- Perfect for small production

### $19/month Plan:

- 10 applications
- 4GB RAM, 4 vCPU
- Built-in databases included

## 🔄 Updating Your App

Push changes to your repository → Coolify auto-deploys!

## 📞 Support

- Coolify Docs: https://coolify.io/docs
- PlanetScale Docs: https://planetscale.com/docs
- HudumaLynk Issues: Create GitHub issues

---

**Total Cost for Free Tier Setup: $0/month**

- Coolify Cloud: Free
- PlanetScale: Free
- Vercel: Free (your frontend)
- Domain: Optional (~$10/year if needed)
