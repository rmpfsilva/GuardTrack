# GuardTrack Demo Guide

## 🎯 Demo Overview

This demo showcases GuardTrack's comprehensive security guard management system with realistic data for three security companies, demonstrating multi-tenant capabilities, inter-company partnerships, and job sharing features.

## 🏢 Demo Companies

### 1. Elite Security Services (DEMO001)
**Admin Login:** `admin.elite` / `demo123`
- **Company ID:** DEMO001
- **Focus:** Corporate and tech sector security
- **Sites:** 3 locations (Corporate Plaza, Shopping Center, Tech Hub)
- **Team:** 1 Admin, 1 Supervisor, 2 Guards

### 2. Guardian Protection Group (DEMO002)
**Admin Login:** `admin.guardian` / `demo123`
- **Company ID:** DEMO002
- **Focus:** Healthcare and industrial security
- **Sites:** 2 locations (City Hospital, Warehouse Complex)
- **Team:** 1 Admin, 1 Supervisor, 2 Guards

### 3. Shield Security Solutions (DEMO003)
**Admin Login:** `admin.shield` / `demo123`
- **Company ID:** DEMO003
- **Focus:** Residential and events security
- **Sites:** 2 locations (Residential Tower, Convention Center)
- **Team:** 1 Admin, 1 Supervisor, 2 Guards

## 👥 Demo User Accounts

All demo users have the password: `demo123`

### Elite Security Services
- **Admin:** admin.elite
- **Supervisor:** super.elite
- **Guards:** john.elite, emma.elite

### Guardian Protection Group
- **Admin:** admin.guardian
- **Supervisor:** super.guardian
- **Guards:** james.guardian, olivia.guardian

### Shield Security Solutions
- **Admin:** admin.shield
- **Supervisor:** super.shield
- **Guards:** william.shield, sophia.shield

## 📋 Key Features to Demonstrate

### 1. Multi-Tenant Company System
- Each company operates independently with isolated data
- Company-specific branding and settings
- Role-based access control (Admin, Supervisor, Guard)

**Demo Steps:**
1. Log in as `admin.elite` (Elite Security)
2. Navigate to Settings to view Company Information
3. Show Company ID: DEMO001
4. Log out and log in as `admin.guardian` (Guardian Protection)
5. Show different company data and Company ID: DEMO002

### 2. Company Partnerships
**Demo Steps:**
1. Log in as `admin.elite`
2. Navigate to Partnerships tab
3. Show **Active Partnerships** tab:
   - Partnership with Guardian Protection Group (accepted)
4. Show **Sent Requests** tab:
   - Pending request to Shield Security (waiting for approval)
5. Switch to `admin.guardian` login
6. Navigate to Partnerships
7. Show accepted partnership with Elite Security
8. Show how to search for companies:
   - By Company ID: Enter "DEMO003"
   - By Company Name: Enter "Shield"
   - By Admin Email: Enter admin email

### 3. Inter-Company Job Sharing
**Demo Steps:**
1. Log in as `admin.elite`
2. Navigate to Job Sharing tab
3. Show **Offered Jobs** (jobs Elite is sharing):
   - Weekend overtime at Corporate Plaza (2 guards needed)
   - Tech Hub weekend shift (3 guards needed)
4. Show **Received Jobs** from partners:
   - Job opportunities from Guardian Protection
5. Click "Create Job Share" to demonstrate:
   - Company dropdown only shows partnered companies (Guardian Protection)
   - Select site, date, role, hourly rate
   - Add requirements and number of positions

### 4. Shift Scheduling
**Demo Steps:**
1. Log in as `admin.elite`
2. Navigate to Schedule/Calendar view
3. Show upcoming shifts for all team members
4. Demonstrate creating a new shift:
   - Select guard (john.elite or emma.elite)
   - Choose site (Downtown Corporate Plaza)
   - Set date and time
   - Save and show in calendar

### 5. Check-In/Check-Out with Geolocation
**Demo Steps:**
1. Log in as `john.elite` (guard account)
2. Navigate to Check-In page
3. Show active shift requiring check-in
4. Demonstrate check-in with geolocation:
   - System captures GPS coordinates
   - Validates location against site coordinates
5. Log in as `admin.elite` to view:
   - Real-time attendance tracking
   - Geolocation verification on map
   - Active vs completed shifts

### 6. Attendance & Reporting
**Demo Steps:**
1. Log in as `admin.elite`
2. Navigate to Reports/Attendance
3. Show weekly attendance summary:
   - Hours worked per guard
   - Completed shifts
   - Break time deductions
4. View detailed shift reports:
   - Check-in/out times
   - Geolocation data
   - Hours calculation with breaks

### 7. Notice Board & Overtime
**Demo Steps:**
1. Log in as `admin.elite`
2. Navigate to Notice Board
3. Show posted notices:
   - **Overtime:** "Urgent: Weekend Overtime Available" at Corporate Plaza
   - **Event:** "VIP Event Security" at Convention Center
   - **Training:** "New Security Protocols" training session
4. Log in as `john.elite` (guard)
5. Show guard view of notices
6. Demonstrate applying to overtime opportunity

### 8. Leave Management
**Demo Steps:**
1. Log in as `john.elite` (guard)
2. Navigate to Leave Requests
3. View existing leave request (approved family vacation)
4. Create new leave request:
   - Select dates
   - Add reason
   - Submit for approval
5. Switch to `admin.elite`
6. Navigate to Leave Requests (admin view)
7. Show pending requests requiring approval
8. Demonstrate approve/reject workflow

### 9. Site Management
**Demo Steps:**
1. Log in as `admin.elite`
2. Navigate to Sites
3. Show configured sites:
   - Downtown Corporate Plaza (£18.50/hr guard rate)
   - Riverside Shopping Center (£17.00/hr guard rate)
   - Tech Innovation Hub (£20.00/hr guard rate)
4. Demonstrate editing site:
   - Update hourly rates by role
   - Add contact information
   - Set geolocation boundaries

### 10. Mobile Responsiveness
**Demo Steps:**
1. Resize browser to mobile view
2. Show mobile-optimized guard interface:
   - Quick check-in button
   - Simplified navigation
   - Touch-friendly controls
3. Show admin dashboard adapts to tablet view:
   - Responsive tables
   - Collapsible sidebar
   - Touch-optimized controls

## 🔍 Advanced Features

### Partnership Validation
- Prevents duplicate partnership requests
- Blocks self-partnerships
- Shows clear error messages:
  - "You have already sent a partnership request"
  - "You are already in partnership with this company"
  - "Cannot partner with your own company"

### Job Sharing Requirements
- Only partnered companies can share jobs
- Partnership must be accepted before job sharing
- Dropdown automatically filters to show only active partners

### Break & Overtime Tracking
- Automatic 1-hour baseline break deduction
- Extended break approval system
- Overtime detection (>30 min past shift end)
- Admin approval required for overtime pay

## 📊 Realistic Demo Data Summary

- **3 Companies** representing different security sectors
- **12 Users** (3 admins, 3 supervisors, 6 guards)
- **7 Security Sites** with varied hourly rates
- **10 Scheduled Shifts** for the upcoming week
- **5 Check-in Records** showing completed and active shifts
- **3 Company Partnerships** (2 accepted, 1 pending)
- **3 Job Shares** between partnered companies
- **4 Notices** (overtime opportunities, events, training)
- **5 Leave Requests** (approved, pending, rejected statuses)

## 🎬 Recommended Presentation Flow

1. **Introduction (2-3 min)**
   - Log in as admin.elite
   - Show Company Information with Company ID
   - Quick dashboard overview

2. **Core Operations (5-7 min)**
   - Shift scheduling and calendar
   - Guard check-in/out with geolocation
   - Real-time attendance tracking

3. **Multi-Company Features (3-5 min)**
   - Company partnerships setup
   - Search and request partnerships
   - Accept/reject workflow

4. **Job Sharing (3-5 min)**
   - Create job share
   - Show partnership requirement
   - Receive and respond to job offers

5. **Administrative Tools (3-5 min)**
   - Leave request workflow
   - Notice board and overtime
   - Reporting and billing

6. **Mobile Demo (2-3 min)**
   - Guard mobile experience
   - Quick check-in flow
   - Responsive design

7. **Q&A and Custom Scenarios**
   - Use remaining demo accounts to answer specific questions
   - Demonstrate any requested features

## 💡 Client Presentation Tips

1. **Start with the "Why"**: Explain the pain points GuardTrack solves
   - Manual timesheets and attendance tracking
   - Difficulty coordinating between companies
   - Lack of real-time visibility
   - Complex billing and overtime calculations

2. **Show Real Workflows**: Use realistic scenarios
   - "Let's say Elite Security needs extra guards for a weekend event..."
   - "A guard calls in sick, how do we quickly find coverage..."
   - "How do we track overtime and ensure accurate billing..."

3. **Highlight Multi-Tenant Benefits**:
   - Complete data isolation between companies
   - Scalable for multiple security businesses
   - Partnership-based job sharing creates network effects

4. **Emphasize Mobile-First Design**:
   - Guards use phones for check-in/out
   - Admins access full features on tablets
   - Progressive Web App capabilities

5. **Address Security & Compliance**:
   - Geolocation verification prevents fraud
   - Audit trail for all actions
   - Role-based access control
   - Secure password hashing

## 🚀 Setting Up Demo Data

### Automated Setup (Recommended)

Run the demo seeder script to automatically create all demo data:

```bash
tsx scripts/seed-demo.ts
```

This will create:
- 3 demo companies (DEMO001, DEMO002, DEMO003)
- 12 demo users (all with password: demo123)
- 7 security sites with realistic locations
- Scheduled shifts, check-ins, partnerships, job shares, notices, and leave requests

### Manual Reset

To reset and recreate the demo data:

```bash
# Clean up existing demo data (optional)
# Then run the seeder
tsx scripts/seed-demo.ts
```

The seeder script uses `ON CONFLICT DO UPDATE` so it's safe to run multiple times - it will update existing demo data instead of creating duplicates.

## 📞 Support

For questions during the demo or to set up a customized demonstration:
- Reference this guide for all demo credentials
- All passwords are: `demo123`
- Company IDs: DEMO001, DEMO002, DEMO003

---

**Last Updated:** October 2025
**Demo Version:** 1.0
**System:** GuardTrack Security Guard Management Platform
