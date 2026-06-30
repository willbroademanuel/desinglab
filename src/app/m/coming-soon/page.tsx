import { ComingSoonModal } from '@/app/components';

export const dynamic = 'force-dynamic';

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ feature?: string }>;
}) {
  const resolvedParams = await searchParams;
  const featureName = resolvedParams?.feature || 'This feature';
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* For hard-refreshed page, we still use the Modal component but it acts like a centered card */}
      <ComingSoonModal featureName={featureName} />
    </div>
  );
}
