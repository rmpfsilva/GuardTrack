# 🎬 GuardTrack Video Demo Script

## 📋 Pre-Recording Checklist

### Before You Hit Record:
- [ ] Run demo seeder: `tsx scripts/seed-demo.ts`
- [ ] Clear browser cookies/cache for clean login
- [ ] Close unnecessary browser tabs
- [ ] Set browser zoom to 100%
- [ ] Hide bookmarks bar (Ctrl/Cmd + Shift + B)
- [ ] Prepare login credentials on a notepad
- [ ] Test microphone audio levels
- [ ] Choose screen resolution: 1920x1080 recommended
- [ ] Close notifications (Do Not Disturb mode)

### Recommended Recording Settings:
- **Resolution:** 1920x1080 (Full HD)
- **Frame Rate:** 30 FPS minimum
- **Audio:** Clear voiceover with minimal background noise
- **Length:** 5-8 minutes (attention span sweet spot)

---

## 🎯 Demo Flow (8 Minutes)

### **SEGMENT 1: Opening Hook (30 seconds)**

**[SCREEN: Login Page]**

**SCRIPT:**
> "Meet GuardTrack - the complete security guard management system that transforms how security companies handle scheduling, attendance, and operations. In the next 7 minutes, I'll show you how GuardTrack eliminates manual paperwork, prevents attendance fraud, and streamlines your entire security operation."

**ACTION:** Hover cursor over the app to show it's live

---

### **SEGMENT 2: Multi-Tenant Architecture (45 seconds)**

**[SCREEN: Login Page → Settings Page]**

**SCRIPT:**
> "GuardTrack is built for multiple security companies from day one. Each company gets their own isolated workspace with a unique Company ID. Let me log in as EliteGuard Security."

**ACTIONS:**
1. Log in: `admin.elite` / `demo123`
2. Navigate to Settings (show Company ID: DEMO001)
3. Point out: "Every company has complete data isolation"

**KEY POINTS TO MENTION:**
- Multi-tenant architecture
- Secure data isolation
- Unique Company ID for easy identification

---

### **SEGMENT 3: User & Role Management (1 minute)**

**[SCREEN: Users Page]**

**SCRIPT:**
> "GuardTrack supports five role levels: Guards, Stewards, Supervisors, Admins, and Super Admins. Each role has specific permissions tailored to their responsibilities."

**ACTIONS:**
1. Click on Users page
2. Show the list of users with different roles
3. Click on one user to show their profile
4. Highlight the role dropdown

**KEY POINTS:**
- Role-based access control
- Guards see only their schedules
- Admins manage everything
- Email invitation system for new users

---

### **SEGMENT 4: Site Management (45 seconds)**

**[SCREEN: Sites Page]**

**SCRIPT:**
> "Security sites are at the heart of GuardTrack. Define your locations with specific hourly rates for each role. This feeds directly into automated billing."

**ACTIONS:**
1. Navigate to Sites
2. Show the list of sites
3. Click on one site to show details (address, rates)
4. Point out different hourly rates: Guard £18.50, Supervisor £25.00

**KEY POINTS:**
- Multiple sites per company
- Role-specific hourly rates
- Automatic billing calculations

---

### **SEGMENT 5: Shift Scheduling (1 minute)**

**[SCREEN: Schedule Page]**

**SCRIPT:**
> "The calendar view makes shift planning effortless. Admins create shifts, assign guards, and everyone sees their schedule in real-time."

**ACTIONS:**
1. Navigate to Schedule page
2. Show calendar view with upcoming shifts
3. Click on a shift to show details (time, site, guard)
4. Show how to create a new shift (don't save, just demo the form)

**KEY POINTS:**
- Visual calendar interface
- Easy shift assignment
- Mobile-friendly for guards on-the-go

---

### **SEGMENT 6: Geolocation Check-In/Out (1.5 minutes)** ⭐ **STAR FEATURE**

**[SCREEN: Check-In Page]**

**SCRIPT:**
> "This is where GuardTrack really shines. Guards can only check in when they're physically at the site. GPS verification eliminates buddy punching and location fraud."

**ACTIONS:**
1. Navigate to Check-In page
2. Show the current active check-in (Guardian guard currently on duty)
3. Point out the map showing exact location
4. Navigate to Attendance page
5. Show completed check-ins with timestamps and locations

**KEY POINTS:**
- GPS-verified attendance
- Eliminates buddy punching
- Real-time location tracking
- Automatic hours calculation
- Break tracking with mandatory deductions

**SCRIPT ADDITION:**
> "The system automatically deducts breaks and calculates overtime. Guards can't cheat the system because the GPS doesn't lie."

---

### **SEGMENT 7: Company Partnerships & Job Sharing (1.5 minutes)** ⭐ **STAR FEATURE**

**[SCREEN: Partnerships Page]**

**SCRIPT:**
> "Here's something unique: GuardTrack enables inter-company collaboration. When you're overwhelmed with jobs, share them with trusted partner companies."

**ACTIONS:**
1. Navigate to Company Partnerships
2. Show the three tabs: Received, Sent, Active
3. Click on "Active Partnerships" tab
4. Show accepted partnerships

**SCRIPT:**
> "First, establish a partnership. Search by Company ID, company name, or admin email. Send a request, they approve it, and you're connected."

**ACTIONS:**
5. Navigate to Job Sharing page
6. Show "Offered Jobs" tab
7. Click on a shared job to show details (site, rate, requirements, number of guards needed)
8. Switch to "Received Jobs" tab
9. Show incoming job requests from partners

**KEY POINTS:**
- Search companies by ID, name, or email
- Must establish partnership before sharing jobs
- Share excess work with trusted partners
- Accept or reject incoming job requests
- Helps during peak demand

**SCRIPT ADDITION:**
> "This turns competitors into collaborators. When you're fully booked, share the overflow instead of turning down clients."

---

### **SEGMENT 8: Notice Board & Overtime (45 seconds)**

**[SCREEN: Notice Board Page]**

**SCRIPT:**
> "The Notice Board keeps your team informed. Post overtime opportunities, events, or training sessions. Guards can apply with one click, and push notifications keep everyone updated."

**ACTIONS:**
1. Navigate to Notice Board
2. Show posted notices (overtime opportunities and events)
3. Click on one notice to show details
4. Show the "Apply" button
5. Mention push notification icon

**KEY POINTS:**
- Overtime opportunities
- Event announcements
- One-click applications
- Push notifications

---

### **SEGMENT 9: Leave Management (45 seconds)**

**[SCREEN: Leave Requests Page]**

**SCRIPT:**
> "Guards request time off through the app. Admins approve or reject with notes. The calendar view shows all leave requests at a glance."

**ACTIONS:**
1. Navigate to Leave Requests
2. Show pending requests
3. Click on one request to show the approval dialog
4. Show approved and rejected examples
5. Switch to calendar view

**KEY POINTS:**
- Digital leave requests
- Approval workflow
- Calendar view
- Email notifications

---

### **SEGMENT 10: Reporting & Billing (1 minute)**

**[SCREEN: Reports/Invoices Page]**

**SCRIPT:**
> "At the end of each week, GuardTrack automatically generates detailed billing reports. Export to CSV or sync directly to Google Sheets for accounting."

**ACTIONS:**
1. Navigate to Reports or Invoices page
2. Show a generated invoice/report
3. Point out the breakdown by site and hourly rates
4. Show the export options (CSV, Google Sheets)
5. Click Print Preview to show professional invoice

**KEY POINTS:**
- Automatic billing calculations
- Export to CSV/Google Sheets
- Professional invoices
- Accurate to the minute

---

### **SEGMENT 11: Mobile Experience (30 seconds)**

**[SCREEN: Resize browser to mobile view OR show on actual phone]**

**SCRIPT:**
> "GuardTrack is fully responsive. Guards use it on their phones for check-ins, viewing schedules, and applying to overtime. Admins can manage everything from their desktop."

**ACTIONS:**
1. Resize browser to mobile size (or show on phone)
2. Navigate through 2-3 pages quickly
3. Show the mobile menu
4. Show check-in interface on mobile

**KEY POINTS:**
- Mobile-first for guards
- Progressive Web App (PWA)
- Install on home screen
- Works offline for critical functions

---

### **SEGMENT 12: Security & Data Protection (30 seconds)**

**[SCREEN: Settings or back to Dashboard]**

**SCRIPT:**
> "Security is paramount. GuardTrack uses industry-standard encryption, secure password hashing, and complete data isolation between companies. Your data is safe, private, and always accessible."

**KEY POINTS:**
- End-to-end security
- Data isolation
- Encrypted storage
- Compliant with data protection standards

---

### **SEGMENT 13: Closing & Call to Action (45 seconds)**

**[SCREEN: Dashboard Overview]**

**SCRIPT:**
> "GuardTrack eliminates paperwork, prevents fraud, and gives you complete visibility into your security operations. From GPS-verified check-ins to inter-company job sharing, it's built for modern security businesses."

**PAUSE (2 seconds)**

**SCRIPT:**
> "Ready to transform your security operations? Visit [YOUR WEBSITE] to schedule a personalized demo. Or try it yourself with a free 14-day trial. No credit card required."

**ACTIONS:**
1. Show dashboard with various widgets
2. Fade to black or show logo
3. Display contact information

**FINAL SCREEN TEXT:**
```
🚀 Get Started Today
📧 Email: [your-email@guardtrack.com]
🌐 Website: [your-website.com]
📞 Phone: [your-phone-number]

Try Free for 14 Days - No Credit Card Required
```

---

## 🎨 Visual Enhancement Tips

### During Recording:
1. **Use Cursor Highlighting** - Enable cursor effects in your recording software
2. **Smooth Transitions** - Take 1-2 seconds between page navigations
3. **Zoom In** - On important features (use Ctrl/Cmd + Plus to zoom browser)
4. **Annotations** - Use recording software to add arrows/highlights in post-production

### Post-Production:
1. **Add Background Music** - Subtle, professional (royalty-free from Epidemic Sound, Artlist)
2. **Add Captions** - Key phrases and feature names
3. **Add Chapter Markers** - So viewers can jump to sections
4. **Add Company Logo** - Watermark in corner (subtle, not distracting)
5. **Color Correction** - Ensure colors pop and look professional

---

## 🎤 Voice-Over Pro Tips

### Delivery:
- **Speak Clearly** - Articulate, moderate pace (not too fast)
- **Energy Level** - Enthusiastic but professional
- **Pauses** - Let features breathe, don't rush
- **Emphasis** - Highlight key benefits ("GPS-verified", "automatic billing")

### What to Emphasize:
1. **Pain Points Solved:** Manual paperwork, attendance fraud, scheduling chaos
2. **Unique Features:** GPS verification, inter-company job sharing, multi-tenant
3. **ROI Benefits:** Time saved, fraud prevention, automatic billing

---

## 📊 Demo Credentials Reference

### Companies:
- **EliteGuard Security (DEMO001):** `admin.elite` / `demo123`
- **Guardian Protection (DEMO002):** `admin.guardian` / `demo123`
- **Shield Security (DEMO003):** `admin.shield` / `demo123`

### For Partnership Demo:
- Log in as EliteGuard to show offered jobs
- Log in as Guardian to show received jobs from EliteGuard

---

## ✅ Final Pre-Flight Check

Before you export and publish:
- [ ] Watch the entire video once
- [ ] Check audio levels (not too loud, not too quiet)
- [ ] Verify no personal information visible
- [ ] Confirm all text is readable at 1080p
- [ ] Add professional intro/outro slides
- [ ] Export in high quality (H.264, 1080p, 30fps)
- [ ] Upload to YouTube, Vimeo, or Loom

---

## 🚀 Where to Use This Demo

1. **Website Homepage** - Above the fold with "Watch Demo" button
2. **Sales Emails** - Embedded or linked
3. **Social Media** - LinkedIn, Twitter (with captions for silent viewing)
4. **Sales Calls** - Share screen during pitch
5. **Email Signatures** - Link to video
6. **Product Hunt Launch** - Featured demo

---

## 💡 Variations to Consider

**Short Version (2 minutes):** Focus on GPS check-in and job sharing only
**Feature-Specific:** Create separate 1-minute videos for each major feature
**Client Testimonial:** After you have users, add their quotes/reactions
**Behind-the-Scenes:** Show how easy it is to set up and use

---

**Good luck with your demo! 🎬 This script will help you create a compelling video that sells GuardTrack's value in under 8 minutes.**
