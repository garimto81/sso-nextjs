// ============================================================================
// Auth Helper Functions Template
//
// 이 파일을 복사해서 다른 Next.js 앱의 lib/auth.ts로 사용하세요
// ============================================================================

import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const AUTH_SECRET = process.env.AUTH_SECRET!

/**
 * 사용자 정보 타입
 */
export interface User {
  id: string
  email: string
  name: string
  role: string
  iat?: number  // Issued at
  exp?: number  // Expiration time
}

/**
 * 현재 로그인한 사용자 정보 가져오기 (Server Component)
 *
 * @returns User 객체 또는 null (로그인 안 됨)
 *
 * @example
 * // Server Component에서 사용
 * const user = await getCurrentUser()
 * if (!user) {
 *   return <div>Loading...</div>
 * }
 * return <div>Hello, {user.name}</div>
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('app-session')

    if (!sessionCookie) {
      return null
    }

    // JWT 토큰 검증 및 디코드
    const decoded = jwt.verify(sessionCookie.value, AUTH_SECRET) as User

    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    }
  } catch (error) {
    console.error('[Auth] Failed to get current user:', error)
    return null
  }
}

/**
 * 사용자가 특정 role을 가지고 있는지 확인
 *
 * @param allowedRoles 허용할 role 목록
 * @returns true/false
 *
 * @example
 * const isAdmin = await hasRole(['admin'])
 * const canAccess = await hasRole(['admin', 'moderator'])
 */
export async function hasRole(allowedRoles: string[]): Promise<boolean> {
  const user = await getCurrentUser()

  if (!user) {
    return false
  }

  return allowedRoles.includes(user.role)
}

/**
 * 사용자가 관리자인지 확인
 *
 * @example
 * const isAdmin = await isUserAdmin()
 * if (!isAdmin) {
 *   redirect('/forbidden')
 * }
 */
export async function isUserAdmin(): Promise<boolean> {
  return hasRole(['admin'])
}

/**
 * 로그아웃 (쿠키 삭제)
 *
 * @example
 * // Server Action에서 사용
 * 'use server'
 * export async function logoutAction() {
 *   await logout()
 *   redirect('/login')
 * }
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete('app-session')
}

/**
 * 세션이 곧 만료되는지 확인 (30분 이내)
 *
 * @returns true/false
 *
 * @example
 * const needsRefresh = await isSessionExpiringSoon()
 * if (needsRefresh) {
 *   // 토큰 갱신 로직
 * }
 */
export async function isSessionExpiringSoon(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('app-session')

    if (!sessionCookie) {
      return false
    }

    const decoded = jwt.decode(sessionCookie.value) as { exp: number }
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)

    // 30분 이내 만료
    return expiresIn < 30 * 60
  } catch {
    return false
  }
}
