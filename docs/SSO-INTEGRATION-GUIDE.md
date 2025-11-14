# SSO 통합 가이드

이 문서는 현재 SSO 시스템을 다른 앱과 연동하는 방법을 설명합니다.

## 🎯 시나리오

현재 시스템: `https://sso-nextjs.vercel.app`
연동할 앱: `app2.example.com` (다른 Next.js 앱)

---

## 방법 1: Supabase Auth 공유 (권장 - 빠른 시작)

### 개요
- 같은 Supabase 프로젝트를 사용
- 각 앱이 독립적으로 인증 처리
- 5분 안에 구현 가능

### 1. 다른 앱에 NextAuth 설치

```bash
npm install next-auth@beta @supabase/supabase-js
```

### 2. 환경 변수 설정

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://dqkghhlnnskjfwntdtor.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
AUTH_SECRET=<새로_생성>
AUTH_URL=http://localhost:3001 # 다른 포트
```

### 3. auth.ts 복사

현재 SSO 시스템의 `auth.ts`를 그대로 복사합니다:

```bash
cp sso-nextjs/auth.ts app2/auth.ts
```

### 4. 로그인 페이지 추가

```bash
cp -r sso-nextjs/app/login app2/app/login
```

### 5. 완료!

이제 두 앱이 같은 사용자 DB를 공유합니다:
- `https://sso-nextjs.vercel.app/login` → 로그인
- `app2.example.com/login` → 같은 계정으로 로그인 가능

**장점**:
- ✅ 5분 만에 구현
- ✅ 같은 사용자 DB
- ✅ 역할 기반 권한 공유

**단점**:
- ❌ 각 앱마다 로그인 필요
- ❌ 한 번 로그인 ≠ 모든 앱 접근

---

## 방법 2: JWT Token 공유 (진정한 SSO)

### 개요
- 한 번 로그인 = 모든 앱 접근
- 같은 도메인 필요 (예: `*.yourdomain.com`)
- Cookie를 통한 토큰 공유

### 전제 조건
- 모든 앱이 같은 도메인의 서브도메인
- HTTPS 필수
- 예: `sso.yourdomain.com`, `app2.yourdomain.com`

### 1. SSO 앱 수정

```typescript
// sso-nextjs/auth.ts
export const { handlers, signIn, signOut, auth } = NextAuth({
  // ... 기존 설정

  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: '.yourdomain.com', // 중요: 점(.) 포함!
      },
    },
  },
})
```

### 2. 다른 앱 설정

```typescript
// app2/auth.ts
import NextAuth from "next-auth"
import { createClient } from '@supabase/supabase-js'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [], // Provider 없음 - 쿠키만 검증

  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`, // 같은 이름!
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: '.yourdomain.com', // 같은 도메인!
      },
    },
  },

  callbacks: {
    async jwt({ token }) {
      if (!token.sub) return token

      // Supabase에서 최신 사용자 정보 가져오기
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, display_name')
        .eq('id', token.sub)
        .single()

      if (profile) {
        token.role = profile.role
        token.name = profile.display_name
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub
        session.user.role = token.role
      }
      return session
    },
  },
})
```

### 3. Middleware 추가

```typescript
// app2/middleware.ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth) {
    // SSO 앱으로 리다이렉트
    const returnTo = encodeURIComponent(req.url)
    return NextResponse.redirect(
      `https://sso.yourdomain.com/login?returnTo=${returnTo}`
    )
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

### 4. 로그인 플로우

1. 사용자가 `app2.yourdomain.com` 접속
2. 세션 없음 → `sso.yourdomain.com/login?returnTo=...`로 리다이렉트
3. SSO 앱에서 로그인
4. 쿠키 생성 (domain=.yourdomain.com)
5. `returnTo` URL로 다시 리다이렉트
6. 이제 `app2`에서도 세션 인식!

**장점**:
- ✅ 한 번 로그인 = 모든 앱 접근
- ✅ 자동 세션 공유
- ✅ 사용자 경험 최고

**단점**:
- ❌ 같은 도메인만 가능
- ❌ HTTPS 필수 (로컬 개발 복잡)

---

## 방법 3: OAuth 2.0 Provider

### 개요
- 표준 OAuth 2.0 프로토콜
- "SSO로 로그인" 버튼
- 크로스 도메인 지원

### 필요한 패키지

```bash
npm install oauth2-server jsonwebtoken
```

### 1. OAuth 엔드포인트 추가

#### Authorize 엔드포인트

```typescript
// sso-nextjs/app/api/oauth/authorize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function GET(request: NextRequest) {
  const session = await auth()
  const searchParams = request.nextUrl.searchParams

  const clientId = searchParams.get('client_id')
  const redirectUri = searchParams.get('redirect_uri')
  const state = searchParams.get('state')

  // 검증
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  // 로그인 확인
  if (!session) {
    // 로그인 페이지로 리다이렉트 (returnTo 포함)
    return NextResponse.redirect(
      `/login?returnTo=${encodeURIComponent(request.url)}`
    )
  }

  // Authorization code 생성 (간단 버전 - 실제로는 DB에 저장)
  const code = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      clientId,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10분
    })
  ).toString('base64')

  // Client 앱으로 리다이렉트
  const callbackUrl = new URL(redirectUri)
  callbackUrl.searchParams.set('code', code)
  if (state) callbackUrl.searchParams.set('state', state)

  return NextResponse.redirect(callbackUrl.toString())
}
```

#### Token 엔드포인트

```typescript
// sso-nextjs/app/api/oauth/token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  const body = await request.json()

  const { code, client_id, client_secret, redirect_uri } = body

  // Code 검증
  let codeData
  try {
    codeData = JSON.parse(Buffer.from(code, 'base64').toString())
  } catch {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
  }

  // 만료 확인
  if (Date.now() > codeData.expiresAt) {
    return NextResponse.json({ error: 'expired_code' }, { status: 400 })
  }

  // Client 검증 (실제로는 DB에서 확인)
  // TODO: client_secret 검증

  // Access token 생성
  const accessToken = jwt.sign(
    {
      sub: codeData.userId,
      client_id: client_id,
    },
    process.env.AUTH_SECRET!,
    { expiresIn: '1h' }
  )

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
  })
}
```

#### UserInfo 엔드포인트

```typescript
// sso-nextjs/app/api/oauth/userinfo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  const token = authHeader.substring(7)

  // Token 검증
  let payload
  try {
    payload = jwt.verify(token, process.env.AUTH_SECRET!)
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
  }

  // 사용자 정보 가져오기
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, display_name')
    .eq('id', payload.sub)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
  }

  return NextResponse.json({
    sub: profile.id,
    email: profile.email,
    name: profile.display_name,
    role: profile.role,
  })
}
```

### 2. 다른 앱에서 OAuth Client 설정

```typescript
// app2/auth.ts
import NextAuth from "next-auth"

const SSOProvider = {
  id: "company-sso",
  name: "Company SSO",
  type: "oauth",
  authorization: {
    url: "https://sso-nextjs.vercel.app/api/oauth/authorize",
    params: {
      scope: "openid profile email",
      response_type: "code",
    },
  },
  token: "https://sso-nextjs.vercel.app/api/oauth/token",
  userinfo: "https://sso-nextjs.vercel.app/api/oauth/userinfo",
  clientId: "app2-client-id",
  clientSecret: "app2-client-secret",
  profile(profile) {
    return {
      id: profile.sub,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    }
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [SSOProvider],
})
```

### 3. 로그인 버튼

```typescript
// app2/app/login/page.tsx
import { signIn } from '@/auth'

export default function LoginPage() {
  return (
    <form
      action={async () => {
        'use server'
        await signIn('company-sso')
      }}
    >
      <button type="submit">SSO로 로그인</button>
    </form>
  )
}
```

**장점**:
- ✅ 표준 프로토콜
- ✅ 크로스 도메인 지원
- ✅ 외부 앱 연동 가능
- ✅ 보안성 높음

**단점**:
- ❌ 구현 복잡도 높음
- ❌ OAuth 서버 유지보수 필요

---

## 🎯 추천 사항

### 빠른 시작
- **방법 1 (Supabase 공유)** 사용
- 5분 안에 구현 가능
- 같은 사용자 DB 공유

### 프로덕션 SSO
- **방법 2 (JWT 공유)** 권장
- 진정한 Single Sign-On 경험
- 같은 도메인 내에서 완벽

### 엔터프라이즈
- **방법 3 (OAuth)** 고려
- 외부 앱 연동
- 표준 프로토콜

---

## 📝 체크리스트

### 방법 1 구현 시
- [ ] 환경 변수 복사
- [ ] auth.ts 복사
- [ ] 로그인 페이지 추가
- [ ] 테스트

### 방법 2 구현 시
- [ ] 도메인 설정 확인
- [ ] HTTPS 인증서 준비
- [ ] Cookie domain 설정
- [ ] Middleware 추가
- [ ] 리다이렉트 플로우 테스트

### 방법 3 구현 시
- [ ] OAuth 엔드포인트 구현
- [ ] Client 등록 시스템
- [ ] Token 저장소 (Redis 권장)
- [ ] Rate limiting
- [ ] 보안 감사

---

## 🔒 보안 고려사항

1. **HTTPS 필수** - 모든 SSO 통신은 HTTPS
2. **CSRF 보호** - NextAuth 기본 제공
3. **Token 만료** - 적절한 만료 시간 설정
4. **Client Secret** - 안전하게 보관
5. **Rate Limiting** - 무차별 대입 공격 방지

---

## 📚 참고 자료

- [NextAuth.js Docs](https://next-auth.js.org)
- [OAuth 2.0 Spec](https://oauth.net/2/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

---

**Version**: 1.0.0
**Last Updated**: 2025-01-14
