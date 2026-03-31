# 📋 Full-Stack Kanban Task Board
**A High-Performance Workflow Management Interface**

A professional-grade Kanban application built with **React**, **TypeScript**, and **Supabase**. This project demonstrates advanced state management, real-time database synchronization, and complex relational data modeling.

## 🚀 Live Application
**[PASTE YOUR VERCEL URL HERE]**

---

## ✨ Features & Functionality

### 1. Core Kanban Engine
- **Drag-and-Drop:** Built using the native HTML5 API for high-performance card movement across status columns.
- **Real-Time Persistence:** All changes sync instantly to a PostgreSQL database via Supabase.
- **Guest Authentication:** Secure anonymous sessions allow users to manage their own private data without a complex signup process.

### 2. Advanced Organization
- **Relational Team Management:** Add teammates and assign them to specific tasks. This uses a **Foreign Key** relationship in the database.
- **Activity Ledger:** A historical audit trail for every task. Click a card to view a timeline of when it was created or moved.
- **Multi-Criteria Filtering:** A powerful search engine that filters by title, description, priority, assignee, or custom labels using **Memoized Derived State**.
- **Visual Urgency:** High-priority items are color-coded, and overdue tasks trigger a red alert badge.

---

## ⚙️ Technical Guide (For Graders & Developers)

### The Architecture
This project follows a **Serverless/BaaS (Backend-as-a-Service)** architecture.
- **Frontend:** React 18 with Vite for optimized builds.
- **Backend:** Supabase handles PostgreSQL hosting, API generation (PostgREST), and Authentication.
- **Security:** Row Level Security (RLS) is enabled at the database level to ensure data isolation between guest sessions.

### Key Logic & Optimization
- **useMemo for Filtering:** Search and filtering are performed on the client-side using `useMemo` to prevent unnecessary re-renders and ensure the UI stays responsive even with large datasets.
- **Optimistic UI:** When a task is dragged, the UI updates immediately before the database call finishes, providing a "zero-latency" feel for the user.
- **Data Modeling:** Uses PostgreSQL **Text Arrays** for labels and **Foreign Key** constraints for assignees and activity logs to ensure data integrity.

---

## 🛠️ Step-by-Step Setup & Deployment

### 1. Local Development Setup
Follow these commands to run the project on your machine:

```bash
# Clone the project
git clone https://github.com/jfm-git-dev/task-manager-assessment
cd task-manager-assessment

# Install all project dependencies
npm install

# Environment Variables
# Create a .env.local file in the root directory and add:
VITE_SUPABASE_URL=https://wgomxtltsobzcbpcxruj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indnb214dGx0c29iemNicGN4cnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NjUzNzksImV4cCI6MjA5MDU0MTM3OX0.WLYJPtq0Svbn_C6HCjlhv8P7zPRhrFes-wYrFKZVKRQ

# Run the dev server
npm run dev
