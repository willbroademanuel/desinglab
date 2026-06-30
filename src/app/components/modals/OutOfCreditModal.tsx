'use client';

import React, { useState } from 'react';
import { X, CreditCard, Phone, ShoppingCart, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ModalWrapper from './ModalWrapper';
import { useTranslation } from '@/lib/i18n/useTranslation';

export default function OutOfCreditModal() {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [maintenanceError, setMaintenanceError] = useState(false);
  const { t } = useTranslation();

  const handleBuyClick = (idx: number) => {
    setLoadingId(idx);
    setMaintenanceError(false);

    // Simulate a secure network API delay before gracefully failing to the maintenance message
    setTimeout(() => {
      setLoadingId(null);
      setMaintenanceError(true);
    }, 1200);
  };

  return (
    <ModalWrapper backdropClass="bg-black/50 dark:bg-black/80 backdrop-blur-sm">
      {(onClose) => (
        <div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-default)] rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_40px_rgba(0,0,0,0.8)] p-6 z-10 max-h-[90vh] overflow-y-auto scrollbar-hide">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--surface-3)] transition-colors"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-gold-light to-primary-gold rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_8px_16px_rgba(212,175,55,0.3)] dark:shadow-[0_0_20px_rgba(212,175,55,0.4)]">
              <CreditCard className="text-black w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{t('credit.topUp')}</h2>
            <p className="text-[var(--text-secondary)] text-sm">
              {t('credit.topUpDesc')}
            </p>
          </div>

          <div className="space-y-3">
            {[
              { credits: 12, price: '3,000' },
              { credits: 24, price: '5,000' },
              { credits: 36, price: '9,000' },
              { credits: 48, price: '10,000' },
            ].map((tier, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-2)] hover:border-primary-gold/50 transition-all group">
                <div className="flex flex-col">
                  <span className="font-semibold text-[var(--text-primary)]">{tier.credits} Credits</span>
                  <span className="text-primary-gold font-bold text-sm tracking-wide">{tier.price} TZS</span>
                </div>
                <button
                  onClick={() => handleBuyClick(idx)}
                  disabled={loadingId !== null}
                  className="flex items-center justify-center gap-1.5 bg-[var(--surface-1)] border border-[var(--border-strong)] hover:border-primary-gold hover:bg-primary-gold text-[var(--text-primary)] hover:text-black font-semibold py-2 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-wait shadow-sm"
                >
                  {loadingId === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                  {t('credit.buy')}
                </button>
              </div>
            ))}
          </div>

          <AnimatePresence>
            {maintenanceError && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-primary-gold/10 border border-primary-gold/30 rounded-xl p-4 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary-gold to-transparent opacity-50" />
                  <p className="text-[13px] text-[var(--text-secondary)] mb-4 leading-relaxed mt-2">
                    {t('credit.maintenanceDesc')}
                    <a href="tel:+255788129212" className="text-primary-gold hover:underline font-semibold mx-1">{t('credit.contact')}</a>
                    {t('credit.maintenanceEnd')}
                  </p>
                  <a
                    href="tel:+255788129212"
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary-gold-light to-primary-gold text-black font-bold py-2.5 px-6 rounded-full hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_4px_14px_rgba(212,175,55,0.2)] dark:shadow-[0_0_20px_rgba(212,175,55,0.2)] w-full sm:w-auto"
                  >
                    <Phone size={16} />
                    {t('credit.call')} 0788129212
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </ModalWrapper>
  );
}
