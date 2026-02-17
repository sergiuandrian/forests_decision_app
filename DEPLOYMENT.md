# Forests Decision App - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Forests Decision App to production.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+ with PostGIS extension
- Git
- Domain name (optional but recommended)

## Deployment Options

### Option 1: GitHub Pages (Frontend Only)

**Pros:**
- Free hosting
- Automatic deployment from Git
- Good for demos and prototypes

**Cons:**
- No backend support
- Limited to static files
- CORS issues with external APIs

**Steps:**
1. Fork the repository
2. Update `package.json` homepage URL
3. Set up GitHub Actions (already configured)
4. Push to main branch for automatic deployment

### Option 2: Full Stack Deployment

#### Frontend Deployment

**Vercel (Recommended):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Netlify:**
```bash
# Build the project
npm run build

# Deploy to Netlify
netlify deploy --prod --dir=dist
```

#### Backend Deployment

**Railway (Recommended):**
1. Connect GitHub repository to Railway
2. Set environment variables
3. Deploy automatically

**Heroku:**
```bash
# Install Heroku CLI
heroku create forests-decision-app-backend
heroku config:set NODE_ENV=production
heroku config:set DB_HOST=your-db-host
heroku config:set DB_USER=your-db-user
heroku config:set DB_PASSWORD=your-db-password
heroku config:set DB_NAME=your-db-name
git push heroku main
```

**DigitalOcean App Platform:**
1. Connect GitHub repository
2. Configure environment variables
3. Set build command: `npm install && npm start`
4. Deploy

## Environment Configuration

### Frontend Environment Variables

Create `.env.production`:
```env
VITE_API_URL=https://your-backend-domain.com/api
```

### Backend Environment Variables

Create `.env` in backend directory:
```env
DB_USER=your_db_user
DB_HOST=your_db_host
DB_NAME=your_db_name
DB_PASSWORD=your_db_password
DB_PORT=5432
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
```

## Database Setup

### PostgreSQL with PostGIS

1. Install PostgreSQL and PostGIS
2. Create database:
```sql
CREATE DATABASE decision_ungheni;
CREATE EXTENSION postgis;
```

3. Import your forest data:
```bash
psql -d decision_ungheni -f your_data.sql
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **CORS**: Configure properly for production domains
3. **Database**: Use strong passwords and limit access
4. **HTTPS**: Always use HTTPS in production
5. **Rate Limiting**: Consider adding rate limiting for API endpoints

## Monitoring and Logging

### Frontend Monitoring
- Add error tracking (Sentry)
- Performance monitoring
- User analytics

### Backend Monitoring
- Application logs
- Database performance
- API response times
- Error tracking

## Performance Optimization

### Frontend
- Enable gzip compression
- Optimize bundle size
- Use CDN for static assets
- Implement lazy loading

### Backend
- Database connection pooling
- Caching strategies
- API response optimization
- File upload limits

## Backup Strategy

1. **Database Backups**: Regular PostgreSQL dumps
2. **File Backups**: Uploaded files backup
3. **Code Backups**: Git repository
4. **Configuration Backups**: Environment variables

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check CORS configuration
2. **Database Connection**: Verify connection string
3. **Build Failures**: Check Node.js version compatibility
4. **API Errors**: Verify environment variables

### Debug Commands

```bash
# Check frontend build
npm run build

# Check backend
cd backend && npm start

# Test API endpoints
curl http://localhost:5000/health

# Check database connection
psql -h your-host -U your-user -d your-db
```

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Monitor disk space
- Check error logs
- Backup database weekly
- Review performance metrics

### Updates
1. Test in staging environment
2. Backup production data
3. Deploy during low-traffic hours
4. Monitor for issues post-deployment 