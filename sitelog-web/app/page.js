import { supabase } from '@/utils/supabase';
import FeedClient from '@/components/FeedClient';
import { cookies } from 'next/headers';

export const revalidate = 0; // Disable cache for MVP so it's always fresh

export default async function Dashboard() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('sitelog_session');

  // Auth Protection
  if (!sessionCookie || !sessionCookie.value) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h2>Welcome to SiteLog</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Please go to your Telegram Bot and type <code>/gallery</code> to generate your secure login link.
        </p>
      </div>
    );
  }

  const userId = sessionCookie.value;

  // Fetch all media items for projects this user created
  // Note: We use an inner join on projects to filter by created_by
  const { data: mediaItems, error } = await supabase
    .from('media_items')
    .select(`
      *,
      projects!inner ( name, created_by )
    `)
    .eq('projects.created_by', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>Failed to load SiteLog data. Please check database connection.</div>;
  }

  return (
    <main>
      <FeedClient initialItems={mediaItems} />
    </main>
  );
}
