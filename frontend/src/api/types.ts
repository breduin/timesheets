export type Role = "owner" | "manager" | "developer" | "viewer";

export type User = { id: number; email: string };

export type Project = {
  id: number;
  name: string;
  description: string;
  status: "active" | "paused" | "archived";
  rate: number;
  is_archived: boolean;
  role: Role;
  tasks_total: number;
  tasks_done: number;
  total_minutes: number;
};

export type Membership = {
  id: number;
  user: User;
  role: Role;
  created_at: string;
};

export type Task = {
  id: number;
  project_id: number;
  project_name: string;
  name: string;
  status: "todo" | "in_progress" | "done" | "cancelled";
  is_archived: boolean;
  total_minutes: number;
};

export type TimeEntry = {
  id: number;
  task: number;
  task_name: string;
  task_status: string;
  project_id: number;
  project_name: string;
  user_id: number;
  user_email: string;
  spent_on: string;
  duration_minutes: number;
  comment: string;
};

export type InviteKind = "email" | "link" | "token";

export type Invite = {
  id: number;
  email: string;
  kind: InviteKind;
  role: Role;
  token: string;
  expires_at: string;
};

export type Report = {
  totals: { minutes: number };
  by_project: { project_id: number; project_name: string; minutes: number }[];
  by_task: {
    task_id: number;
    task_name: string;
    project_id: number;
    project_name: string;
    minutes: number;
  }[];
  by_user?: { user_id: number; email: string; minutes: number }[];
  entries?: {
    id: number;
    spent_on: string;
    duration_minutes: number;
    comment: string;
    task_name: string;
    project_name: string;
    user_email: string;
  }[];
};
