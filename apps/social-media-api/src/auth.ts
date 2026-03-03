import argon2 from "argon2";
import { query } from "./db";

export interface AuthUser {
  user_id: string;
  username: string;
  full_name: string;
  user_type: string;
  roles: string[];
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function getUserRoles(userId: string): Promise<string[]> {
  const result = await query(
    `SELECT r.role_key FROM user_role ur JOIN role r ON r.role_id = ur.role_id WHERE ur.user_id = $1`,
    [userId],
  );
  return result.rows.map((row: { role_key: string }) => row.role_key);
}

export async function authenticate(username: string, password: string): Promise<AuthUser | null> {
  const result = await query(
    `SELECT user_id, username, full_name, password_hash, user_type FROM user_account WHERE username = $1 AND is_active = true`,
    [username],
  );
  if (result.rows.length === 0) return null;

  const user = result.rows[0];
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const roles = await getUserRoles(user.user_id);

  return {
    user_id: user.user_id,
    username: user.username,
    full_name: user.full_name,
    user_type: user.user_type,
    roles,
  };
}

export async function createUser(input: {
  username: string;
  password: string;
  fullName: string;
  userType?: string;
}): Promise<AuthUser> {
  const passwordHash = await hashPassword(input.password);
  const result = await query(
    `INSERT INTO user_account (username, password_hash, full_name, user_type) VALUES ($1, $2, $3, $4) RETURNING user_id, username, full_name, user_type`,
    [input.username, passwordHash, input.fullName, input.userType || "OFFICER"],
  );
  const user = result.rows[0];
  return {
    user_id: user.user_id,
    username: user.username,
    full_name: user.full_name,
    user_type: user.user_type,
    roles: [],
  };
}
