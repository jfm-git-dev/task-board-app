-- Tasks: Primary data store for Kanban cards
CREATE TABLE tasks (
  id bigint primary key generated always as identity,
  title text not null,
  status text default 'To Do',
  description text,
  priority text default 'normal',
  due_date date,
  labels text[] default '{}',
  assignee_id uuid REFERENCES team_members(id),
  user_id uuid default auth.uid()
);

-- Team Members: Stores roster for task assignment
CREATE TABLE team_members (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  color text not null,
  user_id uuid default auth.uid()
);

-- Activity Logs: Historical ledger for task movements
CREATE TABLE activity_logs (
  id uuid default gen_random_uuid() primary key,
  task_id bigint REFERENCES tasks(id) ON DELETE CASCADE,
  action text not null,
  created_at timestamp with time zone default now()
);