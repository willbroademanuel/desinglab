import { SuccessModal } from '@/app/components';

export const dynamic = 'force-dynamic';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <SuccessModal />
    </div>
  );
}
