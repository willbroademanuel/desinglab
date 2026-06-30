import { ComingSoonModal } from '@/app/components';

export const dynamic = 'force-dynamic';

export default async function InterceptedComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const resolvedParams = await searchParams;
  const featureName = resolvedParams?.feature || 'This feature';
  
  return <ComingSoonModal featureName={featureName} />;
}
