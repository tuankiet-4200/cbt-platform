import apiClient from '@/lib/api-client';
import type { AuthUser } from '../store/auth.store';

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  displayName: string;
  email: string;
  phone?: string;
  password: string;
}

interface Envelope<T> {
  data: T;
}

function unwrap<T>(payload: T | Envelope<T>): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as Envelope<T>).data;
  }
  return payload as T;
}

export async function login(payload: LoginPayload) {
  const response = await apiClient.post<AuthResponse | Envelope<AuthResponse>>('/auth/login', payload);
  return unwrap(response.data);
}

export async function register(payload: RegisterPayload) {
  const response = await apiClient.post<AuthResponse | Envelope<AuthResponse>>('/auth/register', payload);
  return unwrap(response.data);
}

export async function refreshSession() {
  const response = await apiClient.post<AuthResponse | Envelope<AuthResponse>>('/auth/refresh');
  return unwrap(response.data);
}

export async function logout() {
  await apiClient.post('/auth/logout');
}
