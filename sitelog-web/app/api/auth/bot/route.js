import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  if (!uid || !token) {
    return new NextResponse("Missing parameters. Use the Telegram Bot to login.", { status: 400 });
  }

  // Recreate the HMAC hash using the same secret (Telegram Bot Token)
  const expectedToken = crypto
    .createHmac('sha256', process.env.TELEGRAM_BOT_TOKEN)
    .update(uid)
    .digest('hex');

  // Verify the token matches
  if (token !== expectedToken) {
    return new NextResponse("Unauthorized. Invalid secure link.", { status: 401 });
  }

  // Set a secure HTTP-only cookie with their Telegram user ID
  const cookieStore = await cookies();
  cookieStore.set('sitelog_session', uid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  });

  // Redirect them to the dashboard feed
  return NextResponse.redirect(new URL('/', request.url));
}
