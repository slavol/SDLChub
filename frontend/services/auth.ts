import api from "@/lib/axios";

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthUser {
  id: number;
  email: string;
  full_name?: string;
  avatar_url?: string | null;
  is_active: boolean;
  is_global_admin?: boolean;
  notification_in_app_enabled?: boolean;
  notification_email_enabled?: boolean;
  notify_task_assignments?: boolean;
  notify_mentions?: boolean;
  notify_calendar?: boolean;
  notify_due_dates?: boolean;
  notify_ai_risk?: boolean;
}

export interface AccountProjectSummary {
  id: number;
  name: string;
  key: string;
  methodology: string;
  role_name: string;
  is_owner: boolean;
  joined_at: string;
}

export interface AccountSummary {
  user: AuthUser;
  projects_count: number;
  projects: AccountProjectSummary[];
}



export interface UserSession {
  id: number;
  user_id: number;
  ip_address?: string | null;
  user_agent?: string | null;
  device_label?: string | null;
  location_hint?: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  is_current: boolean;
}

export interface UserSecurityLog {
  id: number;
  user_id: number;
  session_id?: number | null;
  event_type: string;
  title: string;
  detail?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  has_pending_invites: boolean;
  user: AuthUser;
}

export interface RegisterResponse {
  message: string;
  dev_verification_url?: string;
}

export interface ResendVerificationResponse {
  message: string;
  dev_verification_url?: string;
}

export interface PasswordResetRequestResponse {
  message: string;
  dev_reset_url?: string;
}

export interface GenericMessageResponse {
  message: string;
}

export const loginUser = async (data: LoginData): Promise<AuthResponse> => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

export const registerUser = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post("/auth/register", data);
  return response.data;
};

export const resendVerificationEmail = async (
  email: string
): Promise<ResendVerificationResponse> => {
  const response = await api.post("/auth/resend-verification", { email });
  return response.data;
};

export const getCurrentUser = async (): Promise<AuthUser> => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const getAccountSummary = async (): Promise<AccountSummary> => {
  const response = await api.get("/auth/me/account-summary");
  return response.data;
};

export const updateCurrentUser = async (data: {
  email?: string;
  full_name?: string;
}): Promise<AuthUser> => {
  const response = await api.put("/auth/me", data);
  return response.data;
};

export const uploadCurrentUserAvatar = async (file: File): Promise<AuthUser> => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.post("/auth/me/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const updateCurrentUserPassword = async (data: {
  current_password: string;
  new_password: string;
}): Promise<GenericMessageResponse> => {
  const response = await api.put("/auth/me/password", data);
  return response.data;
};

export interface NotificationPreferencesUpdate {
  notification_in_app_enabled?: boolean;
  notification_email_enabled?: boolean;
  notify_task_assignments?: boolean;
  notify_mentions?: boolean;
  notify_calendar?: boolean;
  notify_due_dates?: boolean;
  notify_ai_risk?: boolean;
}

export const updateNotificationPreferences = async (
  data: NotificationPreferencesUpdate
): Promise<AuthUser> => {
  const response = await api.put("/auth/me/notification-preferences", data);
  return response.data;
};

export const requestPasswordReset = async (
  email: string
): Promise<PasswordResetRequestResponse> => {
  const response = await api.post("/auth/forgot-password", { email });
  return response.data;
};

export const resetPassword = async (
  token: string,
  new_password: string
): Promise<GenericMessageResponse> => {
  const response = await api.post("/auth/reset-password", {
    token,
    new_password,
  });
  return response.data;
};


export const getCurrentUserSessions = async (): Promise<UserSession[]> => {
  const response = await api.get("/auth/me/sessions");
  return response.data;
};

export const revokeCurrentUserSession = async (
  sessionId: number
): Promise<GenericMessageResponse> => {
  const response = await api.delete(`/auth/me/sessions/${sessionId}`);
  return response.data;
};

export const getCurrentUserSecurityLog = async (
  limit = 50
): Promise<UserSecurityLog[]> => {
  const response = await api.get("/auth/me/security-log", { params: { limit } });
  return response.data;
};
