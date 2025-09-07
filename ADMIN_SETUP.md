# Admin Setup Guide

This guide explains how to set up admin access for the Orgle Stream application.

## Overview

The admin dashboard is protected by role-based access control. Only users with the `admin` role can access the admin dashboard to manage concerts.

## Setting Up Admin Users

### Method 1: Using Clerk Dashboard (Recommended)

1. **Access Clerk Dashboard**
   - Go to [https://dashboard.clerk.com](https://dashboard.clerk.com)
   - Select your application

2. **Navigate to Users**
   - Click on "Users" in the sidebar
   - Find the user you want to make an admin

3. **Edit User Metadata**
   - Click on the user's email/username to open their profile
   - Scroll down to the "Public metadata" section
   - Add the following JSON:
   ```json
   {
     "role": "admin"
   }
   ```

4. **Save Changes**
   - Click "Save" to update the user's metadata
   - The user will need to sign out and sign back in for changes to take effect

### Method 2: Using Clerk API (Advanced)

You can also programmatically assign admin roles using the Clerk API:

```javascript
import { clerkClient } from '@clerk/nextjs/server';

await clerkClient.users.updateUserMetadata('user_id', {
  publicMetadata: {
    role: 'admin'
  }
});
```

## Verifying Admin Access

After assigning the admin role:

1. **Sign Out and Sign Back In**
   - The user must sign out and sign back in for the role to take effect

2. **Check for Admin Button**
   - The user should see a purple "Admin" button in the header
   - This button only appears for users with admin role

3. **Access Admin Dashboard**
   - Click the "Admin" button or navigate to `/admin`
   - Non-admin users will be redirected to the dashboard

## Admin Features

Once a user has admin access, they can:

- **View Statistics**: See total concerts, upcoming concerts, past concerts, and concerts with streams
- **Add Concerts**: Create new concerts with full program details
- **Edit Concerts**: Modify existing concert information
- **Delete Concerts**: Remove concerts from the system
- **Manage Programs**: Add, edit, and remove program pieces

## Security Features

- **Server-side Protection**: Middleware checks admin role on every request
- **Client-side Guards**: AdminGuard component prevents unauthorized access
- **API Protection**: Admin-only API endpoints are protected
- **Automatic Redirects**: Non-admin users are redirected to appropriate pages

## Troubleshooting

### Admin Button Not Showing
- Ensure the user has signed out and signed back in
- Check that the role is set to "admin" in Clerk dashboard
- Verify the user's public metadata contains `{"role": "admin"}`

### Access Denied Error
- Confirm the user has the admin role assigned
- Check that the middleware is properly configured
- Ensure the user is signed in

### Setup Page
- Visit `/admin-setup` for a visual guide on setting up admin users
- This page shows current user information and step-by-step instructions

## Development Notes

- Admin role is checked using Clerk's `sessionClaims.metadata.role`
- The middleware redirects non-admin users to `/dashboard`
- Admin status is cached on the client side for performance
- All admin routes are protected at both middleware and component levels
