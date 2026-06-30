import { OutOfCreditModal } from '@/app/components';

export default function OutOfCreditPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* For hard-refreshed page */}
      <OutOfCreditModal />
    </div>
  );
}
