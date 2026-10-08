export type UserRole = 'PASSENGER' | 'ADMIN';

export interface UserProfile {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  role: UserRole;
  preferred_language: string;
  created_at?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  password: string;
  confirm_password: string;
  preferred_language?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
