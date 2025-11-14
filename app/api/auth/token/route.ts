import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

/**
 * SSO Token API
 *
 * 다른 앱에서 이 API를 호출하여 JWT 토큰을 받습니다.
 *
 * @example
 * GET /api/auth/token?returnTo=https://app2.example.com
 *
 * Flow:
 * 1. 세션 확인
 * 2. 세션 없으면 → 로그인 페이지로 리다이렉트
 * 3. 세션 있으면 → JWT 발급 후 returnTo로 리다이렉트
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 현재 세션 확인
    const session = await auth()
    const returnTo = request.nextUrl.searchParams.get('returnTo')

    // 2. 세션 없으면 로그인 필요
    if (!session?.user) {
      console.log('[SSO Token] No session, redirecting to login')

      // returnTo를 보존하면서 로그인 페이지로
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('returnTo', request.url)

      return NextResponse.redirect(loginUrl)
    }

    console.log('[SSO Token] Session found for user:', session.user.email)

    // 3. JWT 토큰 생성
    const token = jwt.sign(
      {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        name: session.user.name,
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.AUTH_SECRET!,
      { expiresIn: '24h' }
    )

    console.log('[SSO Token] Token generated for user:', session.user.email)

    // 4. returnTo가 있으면 해당 URL로 리다이렉트 (토큰 포함)
    if (returnTo) {
      try {
        const redirectUrl = new URL(returnTo)
        redirectUrl.searchParams.set('token', token)

        console.log('[SSO Token] Redirecting to:', redirectUrl.origin)

        return NextResponse.redirect(redirectUrl.toString())
      } catch (error) {
        console.error('[SSO Token] Invalid returnTo URL:', returnTo)
        return NextResponse.json(
          { error: 'Invalid returnTo URL' },
          { status: 400 }
        )
      }
    }

    // 5. returnTo 없으면 JSON으로 토큰 반환
    return NextResponse.json({
      token,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      },
      expiresIn: 86400, // 24시간 (초)
    })

  } catch (error) {
    console.error('[SSO Token] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST 방식으로도 토큰 발급 가능
 *
 * @example
 * POST /api/auth/token
 * Body: { returnTo: "https://app2.example.com" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const returnTo = body.returnTo

    // GET 메서드 로직 재사용
    const url = new URL(request.url)
    if (returnTo) {
      url.searchParams.set('returnTo', returnTo)
    }

    const newRequest = new NextRequest(url, {
      method: 'GET',
      headers: request.headers,
    })

    return GET(newRequest)

  } catch (error) {
    console.error('[SSO Token POST] Error:', error)
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}
