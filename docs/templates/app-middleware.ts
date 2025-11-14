// ============================================================================
// Auth Portal Middleware Template
//
// 이 파일을 복사해서 다른 Next.js 앱의 middleware.ts로 사용하세요
// ============================================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

// 환경 변수에서 설정 가져오기
const SSO_URL = process.env.SSO_URL || 'https://sso-nextjs.vercel.app'
const AUTH_SECRET = process.env.AUTH_SECRET!

if (!AUTH_SECRET) {
  throw new Error('AUTH_SECRET environment variable is required')
}

/**
 * Auth Portal Middleware
 *
 * 동작:
 * 1. 쿠키에 세션 있으면 → 통과
 * 2. URL에 토큰 있으면 → 쿠키에 저장
 * 3. 세션 없으면 → SSO 포털로 리다이렉트
 */
export function middleware(request: NextRequest) {
  // ========== 1. 쿠키에서 세션 확인 ==========
  const sessionCookie = request.cookies.get('app-session')

  if (sessionCookie) {
    try {
      // JWT 토큰 검증
      jwt.verify(sessionCookie.value, AUTH_SECRET)

      // ✅ 세션 유효 - 통과
      return NextResponse.next()
    } catch (error) {
      // 세션 만료 - 쿠키 삭제하고 계속 진행
      console.log('[Middleware] Session expired, cleaning up')
      const response = NextResponse.next()
      response.cookies.delete('app-session')
    }
  }

  // ========== 2. URL에서 토큰 확인 (SSO에서 돌아온 경우) ==========
  const token = request.nextUrl.searchParams.get('token')

  if (token) {
    try {
      // JWT 토큰 검증
      const decoded = jwt.verify(token, AUTH_SECRET) as any
      console.log('[Middleware] Valid token received for user:', decoded.email)

      // 토큰을 쿠키에 저장하고 URL에서 토큰 파라미터 제거
      const url = new URL(request.nextUrl)
      url.searchParams.delete('token')

      const response = NextResponse.redirect(url)

      response.cookies.set('app-session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24시간
        path: '/',
      })

      console.log('[Middleware] Session created, redirecting to:', url.pathname)
      return response
    } catch (error) {
      console.error('[Middleware] Invalid token:', error)
      // 잘못된 토큰 - 계속 진행 (아래에서 SSO로 리다이렉트)
    }
  }

  // ========== 3. 세션 없음 - SSO 포털로 리다이렉트 ==========
  console.log('[Middleware] No session, redirecting to SSO')

  const ssoUrl = new URL(`${SSO_URL}/api/auth/token`)
  ssoUrl.searchParams.set('returnTo', request.url)

  return NextResponse.redirect(ssoUrl.toString())
}

/**
 * Middleware를 적용할 경로 설정
 *
 * 현재 설정: 모든 경로 (API, static 제외)
 *
 * 커스터마이징 예시:
 * - 특정 경로만: ['dashboard/:path*', '/profile/:path*']
 * - 특정 경로 제외: '/((?!api|_next|favicon.ico|public|about).*)'
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|public).*)',
  ],
}
