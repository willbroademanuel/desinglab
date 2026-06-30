import DesignLab from '@/tools/utility-tools/design-lab';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/login');
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <DesignLab />
    </main>
  );
}
