import type { FixStatus } from '@/services/dataFixService'

export const STATUS_LABEL: Record<FixStatus, string> = {
  extracted: 'Not reviewed',
  verified: 'Verified',
  corrected: 'Corrected',
  none_visible: 'Not visible',
  no_loco: 'No loco',
}
