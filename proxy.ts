import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'
const SESSION_COOKIE = 'shield_session'
const sessionSecret = () => process.env.SESSION_SECRET ?? process.env.WEBHOOK_SIGNING_SECRET ?? ''

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  const secret = sessionSecret()
  if (!token || secret.length < 32) return NextResponse.redirect(new URL('/', request.url))
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] })
    return NextResponse.next()
  } catch {
    const response = NextResponse.redirect(new URL('/', request.url))
    response.cookies.delete(SESSION_COOKIE)
    return response
  }
}

export const config = { matcher: ['/dashboard/:path*'] }
