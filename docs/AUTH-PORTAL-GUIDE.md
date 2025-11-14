# Auth Portal 통합 가이드 (가장 쉬운 SSO)

**소요 시간**: 5분
**난이도**: ⭐ 매우 쉬움
**크로스 도메인**: ✅ 지원

---

## 🎯 개요

Auth Portal 패턴은 **가장 쉽고 직관적인 SSO 구현 방법**입니다.

### 핵심 개념
```
SSO 앱 (sso-nextjs.vercel.app) = 인증 전용 포털
         ↓ JWT 토큰 발급
다른 앱들 = 토큰 받아서 세션 생성
```

### 장점
- ✅ **5분 만에 구현** - middleware 하나면 끝
- ✅ **중앙 관리** - 로그인 UI 한 곳에서만
- ✅ **진정한 SSO** - 한 번 로그인 = 모든 앱 접근
- ✅ **크로스 도메인** - 도메인 제약 없음
- ✅ **확장 쉬움** - 앱 100개도 OK

---

## 🚀 빠른 시작 (5분)

### 1. JWT 라이브러리 설치

```bash
cd your-app
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

### 2. 환경 변수 설정

```bash
# .env.local
AUTH_SECRET=d772a8ae1df74a8ca24221c76a4da040fae9cb47e01dd634f4ee46fdaefe944d
SSO_URL=https://sso-nextjs.vercel.app
```

⚠️ **중요**: `AUTH_SECRET`는 SSO 앱과 **동일한 값** 사용!

### 3. Middleware 추가

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

const SSO_URL = process.env.SSO_URL || 'https://sso-nextjs.vercel.app'
const AUTH_SECRET = process.env.AUTH_SECRET!

export function middleware(request: NextRequest) {
  // 1. 쿠키에서 세션 확인
  const sessionCookie = request.cookies.get('app-session')

  if (sessionCookie) {
    try {
      // 토큰 검증
      jwt.verify(sessionCookie.value, AUTH_SECRET)
      return NextResponse.next() // ✅ 세션 유효
    } catch (error) {
      // 세션 만료 - 쿠키 삭제
      const response = NextResponse.next()
      response.cookies.delete('app-session')
    }
  }

  // 2. URL에서 토큰 확인 (SSO에서 돌아온 경우)
  const token = request.nextUrl.searchParams.get('token')

  if (token) {
    try {
      // 토큰 검증
      jwt.verify(token, AUTH_SECRET)

      // 쿠키에 저장하고 토큰 파라미터 제거
      const response = NextResponse.redirect(
        new URL(request.nextUrl.pathname, request.url)
      )

      response.cookies.set('app-session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60, // 24시간
        path: '/',
      })

      return response
    } catch (error) {
      console.error('Invalid token:', error)
    }
  }

  // 3. 세션 없음 → SSO 포털로 리다이렉트
  const ssoUrl = new URL(`${SSO_URL}/api/auth/token`)
  ssoUrl.searchParams.set('returnTo', request.url)

  return NextResponse.redirect(ssoUrl.toString())
}

// 보호할 경로 설정
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
```

### 4. 사용자 정보 가져오기

```typescript
// lib/auth.ts
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export interface User {
  id: string
  email: string
  name: string
  role: string
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('app-session')

  if (!sessionCookie) return null

  try {
    const decoded = jwt.verify(
      sessionCookie.value,
      process.env.AUTH_SECRET!
    ) as User & { iat: number; exp: number }

    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    }
  } catch (error) {
    console.error('Failed to verify token:', error)
    return null
  }
}
```

### 5. 페이지에서 사용

```typescript
// app/page.tsx
import { getCurrentUser } from '@/lib/auth'

export default async function HomePage() {
  const user = await getCurrentUser()

  if (!user) {
    // Middleware가 처리하므로 여기 도달 안 함
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
      <p>Email: {user.email}</p>
      <p>Role: {user.role}</p>
    </div>
  )
}
```

### 6. 완료! 🎉

이제 앱에 접속하면:
1. 자동으로 SSO 포털로 리다이렉트
2. 로그인 (또는 이미 로그인되어 있으면 스킵)
3. JWT 토큰 받아서 돌아옴
4. 앱 정상 접속!

---

## 🌐 사용자 플로우

### 첫 방문 (로그인 필요)
```
1. 사용자가 app.example.com 접속
   ↓
2. Middleware: 세션 없음
   ↓
3. SSO로 리다이렉트: sso-nextjs.vercel.app/api/auth/token?returnTo=app.example.com
   ↓
4. SSO: 세션 없음 → 로그인 페이지
   ↓
5. 사용자 로그인
   ↓
6. SSO: JWT 발급 → app.example.com?token=xxx 리다이렉트
   ↓
7. Middleware: 토큰 쿠키에 저장
   ↓
8. 앱 접속 완료! ✅
```

### 두 번째 방문 (이미 로그인)
```
1. 사용자가 app.example.com 접속
   ↓
2. Middleware: 쿠키에 세션 있음
   ↓
3. 토큰 검증 → 유효
   ↓
4. 앱 바로 접속! ✅ (1초도 안 걸림)
```

### 다른 앱 방문 (SSO 효과)
```
1. 사용자가 app2.example.com 접속 (처음)
   ↓
2. Middleware: 세션 없음
   ↓
3. SSO로 리다이렉트
   ↓
4. SSO: 세션 있음! → JWT 즉시 발급
   ↓
5. app2.example.com?token=xxx 리다이렉트
   ↓
6. 로그인 페이지 안 거침! 바로 접속! ✅
```

---

## 🔐 보안

### 1. JWT 서명 검증
```typescript
jwt.verify(token, AUTH_SECRET) // 위조 불가능
```

### 2. httpOnly 쿠키
```typescript
httpOnly: true, // JavaScript로 접근 불가 (XSS 방지)
```

### 3. HTTPS 필수
```typescript
secure: process.env.NODE_ENV === 'production',
```

### 4. 토큰 만료
```typescript
maxAge: 24 * 60 * 60, // 24시간 후 자동 만료
```

### 5. sameSite 설정
```typescript
sameSite: 'lax', // CSRF 공격 방지
```

---

## 🎨 로그아웃 구현

```typescript
// app/logout/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  cookieStore.delete('app-session')

  // SSO 로그아웃으로 리다이렉트 (옵션)
  return NextResponse.redirect('https://sso-nextjs.vercel.app/api/auth/signout')
}
```

```typescript
// 로그아웃 버튼
<a href="/logout">Logout</a>
```

---

## 🚫 공개 페이지 만들기

특정 페이지를 로그인 없이 접근 가능하게 하려면:

```typescript
// middleware.ts
export const config = {
  matcher: [
    // /public, /about은 제외
    '/((?!api|_next|favicon.ico|public|about).*)',
  ],
}
```

또는:

```typescript
export function middleware(request: NextRequest) {
  // 특정 경로는 검증 스킵
  if (request.nextUrl.pathname.startsWith('/public')) {
    return NextResponse.next()
  }

  // ... 나머지 인증 로직
}
```

---

## 📊 여러 앱 관리 예시

### App 1: 메인 웹사이트
```
Domain: example.com
Middleware: ✅
Paths: /, /dashboard, /profile
```

### App 2: Admin 대시보드
```
Domain: admin.example.com
Middleware: ✅ + Role check (admin만)
Paths: /, /users, /settings
```

### App 3: 모바일 API
```
Domain: api.example.com
Middleware: ✅ (Authorization header로 토큰 전달)
Paths: /api/v1/*
```

### App 4: 마케팅 사이트
```
Domain: marketing.example.com
Middleware: ❌ (로그인 불필요)
Paths: /, /features, /pricing
```

---

## 🔧 고급 설정

### Role 기반 권한

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('app-session')

  if (sessionCookie) {
    try {
      const user = jwt.verify(sessionCookie.value, AUTH_SECRET) as any

      // Admin 페이지 체크
      if (request.nextUrl.pathname.startsWith('/admin')) {
        if (user.role !== 'admin') {
          return NextResponse.redirect(new URL('/forbidden', request.url))
        }
      }

      return NextResponse.next()
    } catch {
      // ...
    }
  }

  // ...
}
```

### API 라우트에서 사용

```typescript
// app/api/data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('app-session')

  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = jwt.verify(sessionCookie.value, process.env.AUTH_SECRET!) as any

    // API 로직
    return NextResponse.json({
      data: 'Protected data',
      user: user.email,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
```

### 토큰 갱신

```typescript
// 토큰 만료 30분 전에 자동 갱신
export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('app-session')

  if (sessionCookie) {
    try {
      const decoded = jwt.decode(sessionCookie.value) as any
      const expiresIn = decoded.exp - Math.floor(Date.now() / 1000)

      // 30분 이내 만료 → 갱신
      if (expiresIn < 30 * 60) {
        const ssoUrl = new URL(`${SSO_URL}/api/auth/token`)
        ssoUrl.searchParams.set('returnTo', request.url)
        return NextResponse.redirect(ssoUrl.toString())
      }

      return NextResponse.next()
    } catch {
      // ...
    }
  }

  // ...
}
```

---

## 🐛 문제 해결

### 1. "Invalid token" 에러

**원인**: AUTH_SECRET가 SSO 앱과 다름

**해결**:
```bash
# SSO 앱의 AUTH_SECRET과 동일하게 설정
AUTH_SECRET=d772a8ae1df74a8ca24221c76a4da040fae9cb47e01dd634f4ee46fdaefe944d
```

### 2. 무한 리다이렉트

**원인**: Middleware matcher가 `/api/auth/token` 포함

**해결**:
```typescript
export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
}
```

### 3. 쿠키가 저장 안 됨

**원인**: SameSite 설정 문제

**해결**:
```typescript
// 개발 환경
sameSite: 'lax',
secure: false, // localhost는 http

// 프로덕션
sameSite: 'lax',
secure: true, // HTTPS 필수
```

### 4. SSO 로그인 후 돌아오지 않음

**원인**: returnTo URL 인코딩 문제

**해결**:
```typescript
ssoUrl.searchParams.set('returnTo', request.url) // 자동 인코딩됨
```

---

## 📈 성능

### 첫 방문 (로그인 필요)
```
Total: ~2-3초
- SSO 리다이렉트: 100ms
- 로그인 페이지 로드: 500ms
- 로그인 처리: 500ms
- JWT 발급: 50ms
- 앱으로 리다이렉트: 100ms
- 앱 로드: 500ms
```

### 이미 로그인 (쿠키 있음)
```
Total: ~500ms
- 토큰 검증: 10ms
- 앱 로드: 500ms
```

### SSO 세션 있음 (다른 앱)
```
Total: ~1초
- SSO 리다이렉트: 100ms
- JWT 발급: 50ms
- 앱으로 리다이렉트: 100ms
- 앱 로드: 500ms
```

---

## ✅ 체크리스트

구현 전:
- [ ] JWT 라이브러리 설치
- [ ] AUTH_SECRET 복사 (SSO 앱과 동일)
- [ ] SSO_URL 설정

구현 후:
- [ ] Middleware 테스트 (보호된 페이지 접근)
- [ ] 로그인 플로우 테스트
- [ ] 로그아웃 테스트
- [ ] 토큰 만료 테스트 (24시간 후)
- [ ] 다른 앱에서 SSO 테스트

프로덕션:
- [ ] HTTPS 인증서 확인
- [ ] AUTH_SECRET 보안 확인
- [ ] 토큰 만료 시간 적절한지 확인
- [ ] 에러 로깅 설정
- [ ] 모니터링 설정

---

## 🎓 요약

**Auth Portal 패턴**은:

✅ **가장 쉬운** SSO 구현 방법
✅ **5분**만에 완성
✅ **중앙 관리** - 로그인 UI 한 곳
✅ **진정한 SSO** - 한 번 로그인
✅ **확장 쉬움** - 앱 추가 2분
✅ **크로스 도메인** - 제약 없음

**추천 대상**:
- 빠르게 SSO 구현하고 싶은 경우
- 여러 앱을 중앙에서 관리하고 싶은 경우
- 도메인이 다른 앱들을 연동하고 싶은 경우
- 유지보수를 최소화하고 싶은 경우

---

**문서 버전**: 1.0.0
**SSO 앱**: https://sso-nextjs.vercel.app
**토큰 API**: https://sso-nextjs.vercel.app/api/auth/token
