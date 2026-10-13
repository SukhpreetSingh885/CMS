# Viralstan Client & Employee Management System (Viralstan CMS)

A modern, production-grade internal agency management application designed specifically for digital marketing agencies to manage clients, employees, master service packages, deliverable project tasks, daily work reports, multi-stage approvals, invoices, payments, renewals, and analytics.

---

## 🚀 Key Features & Architectural Guarantees

1. **Single-Admin Architecture (1 Admin + Multiple Employees)**:
   - Exactly **ONE master Admin account** in the entire database.
   - Any attempt to create additional Admins or promote Employees is strictly prevented at the database and transaction level.
   - The master Admin account cannot be disabled, demoted, or deleted.
   - The single Admin creates and oversees all Employee accounts.

2. **Strictly Two Dashboards & Roles**:
   - **Admin Dashboard** (`/admin/dashboard`): Agency-wide management, employee onboarding, client lifecycle, service & package configuration, task delegation & self-assignment, centralized approval center, financial records, audit logs, and PDF/Excel reports.
   - **Employee Dashboard** (`/employee/dashboard`): Assigned tasks (0–100% progress updater), daily work report submissions with history tracking, reviewer feedback, assigned clients, work calendar, and personal productivity statistics.
   - *No Super Admin, No Client Portal, No Third Dashboards.*

3. **100% Database-Driven — Zero Mock / Fake Data**:
   - Every single metric, KPI card, table, chart, report, and activity is computed directly from live MySQL records via Prisma queries.
   - When no records exist in the database, clear and helpful empty states are displayed.

4. **Zero Client Health Scores**:
   - Explicitly designed with zero health scores, health percentages, risk categories, or health widgets anywhere in database models, backend logic, or frontend UI.

5. **Task Self-Assignment & Daily Report Self-Reviews**:
   - Admin can assign tasks to themselves and submit daily work reports.
   - Self-reviews are explicitly flagged with `isSelfReviewed: true` and recorded in audit logs and report revision histories.

6. **Financial Management & Exports**:
   - Invoices, payments, and upcoming renewals tracked in Indian Rupee (`₹` INR) and IST timezone.
   - 8 distinct report modules exportable to **PDF** (PDFKit) and **Excel** (ExcelJS).

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui design language + Lucide React icons
- **State & Routing**: TanStack React Query + React Router DOM v7
- **Forms & Validation**: React Hook Form + Zod
- **Data Visualization**: Recharts
- **Notifications**: Sonner

### Backend
- **Runtime & Framework**: Node.js + Express.js + TypeScript
- **ORM & Database**: Prisma ORM + MySQL
- **Authentication**: JWT access tokens + HTTP-only cookies with token refresh rotation
- **Security**: Argon2/Bcrypt password hashing, Helmet, CORS, Rate Limiting, Centralized Global Error Handling
- **Reporting & Uploads**: Multer, PDFKit, ExcelJS

---

## 📂 Project Structure

```text
CMS/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # 24 normalized relational models
│   │   └── seed.ts             # Master catalog and Initial Admin bootstrap
│   ├── src/
│   │   ├── config/             # Environment, DB singleton, constants
│   │   ├── controllers/        # REST API controllers
│   │   ├── jobs/               # Background renewal reminder cron
│   │   ├── middlewares/        # Auth, RBAC, global error, validation, rateLimit
│   │   ├── routes/             # Versioned API routes (/api/v1/...)
│   │   ├── scripts/            # Database migration & single admin transition
│   │   ├── services/           # Core business logic & transactions
│   │   ├── utils/              # JWT, password, logger, error codes, response
│   │   ├── validators/         # Zod request validators
│   │   ├── app.ts              # Express application configuration
│   │   └── server.ts           # HTTP server initialization & crash prevention
│   ├── tests/                  # Vitest unit and business rule tests
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI, dialogs, status badges, ErrorBoundary
│   │   ├── context/            # AuthContext with session refresh
│   │   ├── layouts/            # AdminLayout, EmployeeLayout, AuthLayout
│   │   ├── pages/
│   │   │   ├── auth/           # Login, ForgotPassword
│   │   │   ├── admin/          # Dashboard, Employees, Clients, Tasks,
│   │   │   │                   # DailyReports, Approvals, Calendar, Meetings,
│   │   │   │                   # Communications, Files, Invoices, Payments,
│   │   │   │                   # Renewals, Reports, Analytics, Settings
│   │   │   └── employee/       # Dashboard, MyClients, MyTasks, ReportSubmit,
│   │   │                       # MyReports, Calendar, Profile
│   │   ├── services/           # Axios API client with token refresh queue
│   │   ├── types/              # Full TypeScript type definitions
│   │   ├── App.tsx             # Root app with query client, router & ErrorBoundary
│   │   └── main.tsx
│   └── package.json
└── README.md
```

---

## ⚙️ Quick Start & Setup

### Prerequisites
- Node.js `v18+` or `v22+`
- MySQL Server running locally (or via Docker / cloud)

---

### Step 1: Database Setup & Backend Initialization

1. Create a MySQL database (e.g., `viralstan_cms`):
   ```sql
   CREATE DATABASE viralstan_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Navigate to the `backend` directory and configure environment variables:
   ```bash
   cd backend
   cp .env.example .env
   ```
   *Edit `.env` with your MySQL connection string and initial Admin credentials:*
   ```env
   DATABASE_URL="mysql://root:password@localhost:3306/viralstan_cms"
   PORT=5000
   INITIAL_ADMIN_EMAIL="admin@viralstan.com"
   INITIAL_ADMIN_PASSWORD="YourSecureAdminPassword"
   INITIAL_ADMIN_NAME="Master Admin"
   ```

3. Install dependencies, push Prisma schema, and run master catalog seed:
   ```bash
   npm install
   npx prisma db push
   npm run prisma:seed
   ```

4. Run the backend development server:
   ```bash
   npm run dev
   ```
   *The backend API will start on `http://localhost:5000`.*

---

### Step 2: Frontend Setup

1. Navigate to the `frontend` directory:
   ```bash
   cd ../frontend
   cp .env.example .env
   ```
   *Ensure `.env` points to the backend API:*
   ```env
   VITE_API_URL=http://localhost:5000/api/v1
   ```

2. Install dependencies and start the frontend development server:
   ```bash
   npm install
   npm run dev
   ```
   *The frontend application will start on `http://localhost:5173`.*

---

## 🧪 Testing & Verification

Run the test suite in the backend:
```bash
cd backend
npm test
```
