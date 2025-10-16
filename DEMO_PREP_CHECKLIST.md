# ✅ GuardTrack Demo Preparation Checklist

## 🎯 Purpose
Ensure your GuardTrack app is perfectly polished before recording your demo video or presenting to clients.

---

## 📋 Pre-Demo Setup (15 minutes)

### 1. Database Setup
- [ ] Run demo seeder: `tsx scripts/seed-demo.ts`
- [ ] Verify all demo data loaded successfully
- [ ] Check that 3 companies exist (DEMO001, DEMO002, DEMO003)
- [ ] Confirm 12 users were created
- [ ] Verify partnerships and job shares are set up

### 2. Application State
- [ ] Restart the application: `npm run dev`
- [ ] Verify no errors in the console
- [ ] Check that all pages load correctly
- [ ] Test login with all three demo accounts

### 3. Browser Setup
- [ ] Use Chrome or Firefox (best compatibility)
- [ ] Set zoom to 100% (Ctrl/Cmd + 0)
- [ ] Clear browser cache and cookies
- [ ] Hide bookmarks bar (Ctrl/Cmd + Shift + B)
- [ ] Close unnecessary tabs
- [ ] Disable browser extensions (or use Incognito/Private mode)
- [ ] Set screen resolution to 1920x1080

---

## 🧪 Functionality Check (10 minutes)

### Test Each Core Feature:

#### Authentication
- [ ] Login works with demo credentials
- [ ] Logout works properly
- [ ] Different roles show appropriate permissions

#### Dashboard
- [ ] All widgets display correct data
- [ ] No loading errors
- [ ] Stats are accurate

#### Users Management
- [ ] User list loads
- [ ] Can view user details
- [ ] Role badges display correctly

#### Sites Management
- [ ] Sites list loads
- [ ] Site details show correctly
- [ ] Hourly rates display properly

#### Shift Scheduling
- [ ] Calendar view loads
- [ ] Shifts display on correct dates
- [ ] Can view shift details

#### Check-In/Out
- [ ] Active check-ins display
- [ ] Location map loads (if applicable)
- [ ] Status badges show correctly

#### Company Partnerships
- [ ] All three tabs work (Received, Sent, Active)
- [ ] Partnerships display correctly
- [ ] Search functionality works

#### Job Sharing
- [ ] Offered jobs display
- [ ] Received jobs display
- [ ] Job details load properly

#### Notice Board
- [ ] Notices list loads
- [ ] Can view notice details
- [ ] Types (overtime/event) display correctly

#### Leave Requests
- [ ] Requests list loads
- [ ] Can view request details
- [ ] Status badges correct (approved/pending/rejected)

#### Reports/Invoices
- [ ] Reports generate correctly
- [ ] Invoice displays properly
- [ ] Export buttons work (don't need to actually export)

---

## 🎨 Visual Polish (5 minutes)

### Design Check:
- [ ] All colors match your brand
- [ ] No placeholder text ("Lorem ipsum", "TODO", etc.)
- [ ] Icons render correctly
- [ ] Buttons have proper styling
- [ ] Forms are well-aligned
- [ ] Tables are properly formatted
- [ ] Mobile view looks good (resize browser)

### Content Check:
- [ ] All demo data is realistic (no "Test User", "Test Company")
- [ ] Dates are current/future (not in the past)
- [ ] No debug console logs visible
- [ ] No error messages on any page

---

## 📱 Mobile Responsiveness (5 minutes)

### Resize browser to mobile width (375px):
- [ ] Navigation menu works (hamburger menu)
- [ ] All pages are readable
- [ ] Buttons are tap-friendly
- [ ] Forms work on mobile
- [ ] Tables scroll horizontally if needed
- [ ] Check-in page works on mobile

---

## 🔐 Security & Privacy Check

### Before Recording:
- [ ] No real company data visible
- [ ] Demo passwords are simple (demo123)
- [ ] No API keys or secrets in view
- [ ] No personal information exposed
- [ ] Browser history cleared

---

## 📊 Data Verification

### Verify Demo Accounts:

**EliteGuard Security (DEMO001)**
- [ ] Username: `admin.elite` / Password: `demo123`
- [ ] Has multiple guards, sites, shifts
- [ ] Has active partnerships
- [ ] Has offered jobs

**Guardian Protection (DEMO002)**
- [ ] Username: `admin.guardian` / Password: `demo123`
- [ ] Has received jobs from EliteGuard
- [ ] Has pending partnership requests
- [ ] Has active check-ins

**Shield Security (DEMO003)**
- [ ] Username: `admin.shield` / Password: `demo123`
- [ ] Has pending job requests
- [ ] Has leave requests to show approval workflow

---

## 🎬 Recording Setup

### Audio:
- [ ] Microphone tested and working
- [ ] Background noise minimized
- [ ] Audio levels checked (not too loud/quiet)

### Screen:
- [ ] Recording software ready (Loom, OBS, etc.)
- [ ] Screen resolution set to 1920x1080
- [ ] Notifications disabled (Do Not Disturb)
- [ ] Cursor highlighting enabled (if available)

### Environment:
- [ ] Quiet location for recording
- [ ] No interruptions expected
- [ ] Water nearby (stay hydrated!)

---

## 📝 Demo Flow Preparation

### Have Ready:
- [ ] VIDEO_DEMO_SCRIPT.md open in another window
- [ ] Login credentials on notepad
- [ ] Features to highlight memorized
- [ ] Talking points ready

### Demo Path Planned:
1. [ ] Start at login
2. [ ] Show Settings (Company ID)
3. [ ] Show Users
4. [ ] Show Sites
5. [ ] Show Scheduling
6. [ ] **Highlight Check-In/GPS** ⭐
7. [ ] **Highlight Job Sharing** ⭐
8. [ ] Show Notice Board
9. [ ] Show Leave Requests
10. [ ] Show Reports/Invoices
11. [ ] Show Mobile View
12. [ ] Close with Dashboard

---

## 🚀 Final Go/No-Go Check

### All Systems Ready:
- [ ] Demo data loaded ✅
- [ ] All features working ✅
- [ ] App looks polished ✅
- [ ] Recording setup complete ✅
- [ ] Script reviewed ✅
- [ ] You're ready and confident ✅

---

## 🆘 Troubleshooting

### If something isn't working:

**Demo data issues:**
```bash
# Re-run the seeder
tsx scripts/seed-demo.ts
```

**App not loading:**
```bash
# Restart the app
npm run dev
```

**Weird UI issues:**
```bash
# Clear browser cache and hard refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

**Database errors:**
```bash
# Check database connection
npm run db:push
```

---

## ✨ You're Ready!

Once all checkboxes are ticked, you're ready to create an amazing demo video that will sell GuardTrack to your clients. 

**Remember:** Enthusiasm is contagious. Show your passion for the product, and your clients will feel it too!

🎬 **Lights, Camera, Action!**
