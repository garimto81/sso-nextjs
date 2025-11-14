# NextAuth.js + Supabase SSO

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/garimto81/sso-nextjs)

**Live Demo**: https://sso-nextjs.vercel.app

Next.js 14 인증 시스템 with NextAuth.js v5 + Supabase

## 📋 Features

- ✅ **NextAuth.js v5** - 최신 Auth.js 통합
- ✅ **Supabase Auth** - PostgreSQL + Row Level Security
- ✅ **Role-based Access Control** - Admin/User 권한 관리
- ✅ **JWT Sessions** - httpOnly 쿠키, CSRF 보호
- ✅ **Protected Routes** - Middleware 기반 라우트 보호
- ✅ **TypeScript** - 완전한 타입 안정성
- ✅ **Shadcn UI** - 모던한 UI 컴포넌트
- ✅ **Dark Mode** - next-themes 통합

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase 계정 및 프로젝트
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/garimto81/sso-nextjs.git
cd sso-nextjs

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# AUTH_SECRET=your-auth-secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Run database migrations
# Option 1: Copy supabase/all-migrations-fixed.sql to Supabase Dashboard SQL Editor
# Option 2: Use Supabase CLI (if configured)

# Start development server
npm run dev
```

Open http://localhost:3000/login

### Test Accounts

After running migrations, create an admin user in Supabase Dashboard:

1. Go to Authentication → Users → Add User
2. Email: `admin@example.com`, Password: `Admin1234!`
3. Check "Auto Confirm User"
4. Run SQL:
   ```sql
   UPDATE profiles
   SET role = 'admin', display_name = 'Admin User'
   WHERE email = 'admin@example.com';
   ```

## 📚 Documentation

- **[Deployment Guide](DEPLOYMENT.md)** - Vercel 배포 가이드
- **[PRD](docs/prd.md)** - Product Requirements Document (v2.0)
- **[CLAUDE.md](CLAUDE.md)** - AI Agent 개발 가이드

## 🏗️ Project Structure

```
sso-nextjs/
├── app/                    # Next.js App Router
│   ├── api/auth/          # NextAuth.js API routes
│   ├── login/             # Login page
│   ├── admin/             # Protected admin page
│   └── forbidden/         # Access denied page
├── auth.ts                # NextAuth configuration (124 lines - minimal)
├── middleware.ts          # Route protection
├── lib/                   # Utilities
│   ├── supabase/         # Supabase clients
│   ├── env.ts            # Environment validation (Zod)
│   └── utils.ts          # Helpers
├── components/            # UI components (Shadcn)
├── supabase/             # Database
│   ├── migrations/       # SQL migration files
│   └── all-migrations-fixed.sql  # Complete migration
└── types/                # TypeScript definitions
```

## 🔐 Security Features

- **httpOnly Cookies** - XSS 방지
- **CSRF Protection** - NextAuth 기본 제공
- **RLS Policies** - Supabase Row Level Security
- **JWT Sessions** - 24시간 만료
- **Environment Validation** - Zod 스키마
- **Service Role Isolation** - 서버 전용 key

## 🧪 Testing

```bash
# Run E2E tests
npm run test:e2e

# Run in UI mode
npx playwright test --ui
```

## 📦 Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 14.2+ |
| Auth | NextAuth.js v5 (beta.30) |
| Database | Supabase (PostgreSQL) |
| Language | TypeScript 5.7+ |
| Styling | TailwindCSS + Shadcn UI |
| Theme | next-themes |
| Testing | Playwright |

## 🌐 Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/garimto81/sso-nextjs)

1. Click "Deploy" button above
2. Set environment variables (see `env.production.template`)
3. Deploy!

Or manually:

```bash
npm i -g vercel
vercel --prod
```

**Required Environment Variables:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SECRET` (새로 생성 필요!)
- `AUTH_URL` (Vercel이 자동 설정)

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## 📝 Database Schema

### Tables

**profiles**
```sql
- id: UUID (FK → auth.users.id)
- email: TEXT UNIQUE
- role: TEXT ('admin' | 'user')
- display_name: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

**login_attempts** (optional, for rate limiting)
- Tracks login attempts
- IP address, user agent, success/failure

**account_lockouts** (optional, for security)
- 5 failed attempts → 10 min lockout

### RLS Policies

- Users can view/update own profile
- Service role bypasses RLS (for auth.ts)
- Admin policies removed to prevent recursion

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint
npm run lint

# Run tests
npm test
```

## 🐛 Troubleshooting

### Login fails with "infinite recursion" error

**Fix**: Remove "Admin can view all profiles" RLS policy
```sql
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
```

### CSRF token mismatch

**Fix**:
1. Ensure `AUTH_SECRET` is set (min 32 chars)
2. Ensure `AUTH_URL` matches deployment URL

### Build fails on Vercel

**Fix**:
1. Check TypeScript errors: `npx tsc --noEmit`
2. Check ESLint errors: `npm run lint`
3. Review Vercel build logs

## 🤝 Contributing

This is a personal project, but feel free to fork and customize!

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

- Built with [Claude Code](https://claude.com/claude-code)
- UI components from [Shadcn UI](https://ui.shadcn.com)
- Auth by [NextAuth.js](https://next-auth.js.org)
- Database by [Supabase](https://supabase.com)

## 📧 Contact

- GitHub: [@garimto81](https://github.com/garimto81)
- Repository: [sso-nextjs](https://github.com/garimto81/sso-nextjs)

---

**Version**: 0.1.0
**Last Updated**: 2025-01-14
**Status**: ✅ Production Ready
