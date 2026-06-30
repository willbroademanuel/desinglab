import DesignLab from '@/tools/utility-tools/design-lab';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/login');
  }

  // Senior dev approach: Gracefully handle missing profile data with safe defaults
  let userProfile = {
    username: session.user.user_metadata?.username || 'Designer',
    avatar_url: session.user.user_metadata?.avatar_url || '',
    credits: 0,
    email: session.user.email || '',
  };

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, avatar_url, credits')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.warn(`[Page/Home] Failed to fetch profile for user ${session.user.id}:`, error.message);
      // fallback already set
    } else if (profile) {
      userProfile = {
        ...userProfile,
        username: profile.username || userProfile.username,
        avatar_url: profile.avatar_url || userProfile.avatar_url,
        credits: profile.credits ?? 0,
      };
    }
  } catch (err) {
    console.error('[Page/Home] Unexpected error fetching profile:', err);
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <DesignLab userProfile={userProfile} />
    </main>
  );
}
