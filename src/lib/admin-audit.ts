/**
 * lib/admin-audit.ts
 * ─────────────────────────────────────────────────────────────────
 * Shared admin audit logger.
 * Called after every successful template / category mutation to write
 * an immutable record to `admin_audit_logs`.
 *
 * The table already exists with: id, admin_id, action_type, target_user_id, details, created_at.
 * For template/category actions, target_user_id is NULL (it's nullable in the schema).
 *
 * action_type values used here:
 *   template_created | template_updated | template_deleted (soft)
 *   template_restored | template_published | template_unpublished
 *   template_visibility_toggled | template_featured_toggled
 *   template_version_reverted | sandbox_generation
 *   category_created | category_updated | category_deleted
 * ─────────────────────────────────────────────────────────────────
 */

import { SupabaseClient } from '@supabase/supabase-js';

type AuditActionType =
  | 'template_created'
  | 'template_updated'
  | 'template_deleted'
  | 'template_permanently_deleted'
  | 'template_restored'
  | 'template_published'
  | 'template_unpublished'
  | 'template_visibility_toggled'
  | 'template_featured_toggled'
  | 'template_version_reverted'
  | 'sandbox_generation'
  | 'category_created'
  | 'category_updated'
  | 'category_deleted';

interface LogAdminActionParams {
  supabase: SupabaseClient;
  adminId: string;
  actionType: AuditActionType;
  details: Record<string, unknown>;
}

/**
 * Writes a row to admin_audit_logs.
 * Non-throwing — a logging failure must never break the primary action.
 * Errors are silently captured and logged to console for observability.
 */
export async function logAdminAction({
  supabase,
  adminId,
  actionType,
  details,
}: LogAdminActionParams): Promise<void> {
  try {
    const { error } = await supabase.from('admin_audit_logs').insert({
      admin_id: adminId,
      action_type: actionType,
      target_user_id: null, // Not applicable for template/category ops
      details,
    });

    if (error) {
      // Non-fatal: log to console for observability but don't throw
      console.error('[logAdminAction] Failed to write audit log:', {
        actionType,
        adminId,
        error: error.message,
      });
    }
  } catch (err) {
    console.error('[logAdminAction] Unexpected audit log error:', err);
  }
}
