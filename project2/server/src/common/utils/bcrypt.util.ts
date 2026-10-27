import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/** 密码加密（bcrypt 含随机盐，不可逆） */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** 密码比对 */
export async function comparePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
