# Railway Deployment Guide

This guide walks you through deploying the Pre-DTCT Form Generator to Railway.

## Prerequisites

1. A Railway account (sign up at https://railway.app)
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. All files committed including the new Railway configuration files

## Files Added for Railway

The following files have been created for Railway deployment:

- `Procfile` - Tells Railway how to start the application
- `runtime.txt` - Specifies Python version
- `.railwayignore` - Excludes unnecessary files from deployment
- `requirements.txt` - Updated with gunicorn for production
- `main.py` - Updated to work in production environment

## Deployment Steps

### Step 1: Push Your Code to GitHub

If you haven't already, push your code to GitHub:

```bash
git add .
git commit -m "Add Railway deployment configuration"
git push origin v2
```

### Step 2: Create a New Railway Project

1. Go to https://railway.app and log in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorise Railway to access your GitHub account
5. Select your `dtct2` repository
6. Select the `v2` branch

### Step 3: Configure Environment Variables (Optional)

Railway will automatically detect your Flask app. If you need custom settings:

1. Go to your project dashboard
2. Click on your service
3. Go to "Variables" tab
4. Add any environment variables if needed:
   - `SECRET_KEY` - A secure random string for Flask sessions (recommended)
   - `FLASK_ENV` - Set to `production`

Example SECRET_KEY generation (run locally):
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 4: Wait for Deployment

Railway will automatically:
1. Detect Python application
2. Install dependencies from `requirements.txt`
3. Run the application using the `Procfile`
4. Assign a public URL

This usually takes 2-5 minutes.

### Step 5: Access Your Application

1. Once deployment completes, you'll see a green "Active" status
2. Click "Settings" tab
3. Under "Networking", you'll see your public domain (e.g., `your-app.up.railway.app`)
4. Click the URL to open your application

### Step 6: Set Up Persistent Storage (Important!)

By default, Railway provides persistent storage automatically. Your SQLite database and generated Excel files will persist between deployments.

To verify storage is working:
1. Generate an Excel file through your app
2. Redeploy or restart the service
3. Check if the file still exists in the `/output` directory

## Post-Deployment

### Custom Domain (Optional)

1. Go to "Settings" tab in your Railway project
2. Under "Networking" → "Custom Domain"
3. Add your domain and follow DNS instructions

### Monitor Your Application

1. View logs in the "Deployments" tab
2. Click on any deployment to see detailed logs
3. Use logs to troubleshoot any issues

### Update Your Application

To deploy updates:

```bash
git add .
git commit -m "Your update message"
git push origin v2
```

Railway will automatically detect the push and redeploy.

## Troubleshooting

### Application Won't Start

Check the deployment logs:
1. Go to "Deployments" tab
2. Click on the failed deployment
3. Review the build and deploy logs

Common issues:
- Missing dependencies in `requirements.txt`
- Python version mismatch
- Database initialisation errors

### Database Issues

If the database isn't persisting:
1. Check that `/data` directory has write permissions
2. Verify Railway volume is mounted correctly
3. Check deployment logs for database errors

### Excel Files Not Generating

1. Verify `/output` directory exists and is writable
2. Check deployment logs for file write errors
3. Ensure `data/glossary/*.xlsx` files are present

### Port Issues

Railway automatically sets the `PORT` environment variable. The updated `main.py` handles this automatically.

## Cost Estimation

Railway pricing:
- **Free tier**: $5 worth of usage per month (usually sufficient for development/testing)
- **Hobby plan**: $5/month for additional usage
- **Pro plan**: $20/month for production workloads

Your app should run comfortably on the free tier for testing purposes.

## Environment Differences

### Development (Local)
- Runs on `http://127.0.0.1:5000`
- Opens browser automatically
- Uses local SQLite database
- Files stored in local `output/` directory

### Production (Railway)
- Runs on Railway-assigned URL
- No browser auto-open
- Uses Railway persistent storage
- Environment variable `RAILWAY_ENVIRONMENT` is set

## Security Recommendations

1. **Set SECRET_KEY**: Always set a secure SECRET_KEY in Railway environment variables
2. **Database backups**: Regularly backup your SQLite database
3. **File cleanup**: Consider implementing automatic cleanup of old Excel files
4. **Authentication**: Consider adding user authentication for production use

## Support

For Railway-specific issues:
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

For application issues:
- Check deployment logs in Railway dashboard
- Review application logs for errors

## Next Steps

After successful deployment:
1. Test all functionality thoroughly
2. Set up monitoring/alerts
3. Configure custom domain (if needed)
4. Implement regular backups
5. Consider adding authentication for production use
