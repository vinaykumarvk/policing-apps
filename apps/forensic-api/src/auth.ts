import {
  hashPassword,
  verifyPassword,
  getUserRoles as _getUserRoles,
  authenticate as _authenticate,
  createUser as _createUser,
} from "@puda/api-core";
import { query } from "./db";

export type { AuthUser, AuthResult } from "@puda/api-core";
export { hashPassword, verifyPassword };

export function getUserRoles(userId: string) {
  return _getUserRoles(query, userId);
}

export function authenticate(username: string, password: string) {
  return _authenticate(query, username, password);
}

export function createUser(input: { username: string; password: string; fullName: string; userType?: string }) {
  return _createUser(query, input);
}
