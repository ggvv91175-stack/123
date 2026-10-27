import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type Role = 'admin' | 'student';
/** 标记接口所需角色，如 @Roles('admin') */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
