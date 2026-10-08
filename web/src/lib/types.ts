/**
 * Domain types mirroring the Supabase schema.
 * Source of truth: DATA_API_CONTRACTS.md and supabase/migrations/.
 *
 * These are hand-maintained rather than generated so that a mismatch between a
 * migration and this file is a type error rather than silent drift.
 */

export type ShopRole = 'owner' | 'manager' | 'staff';

export type ShopPermission =
  | 'deal.view'
  | 'deal.create'
  | 'deal.edit'
  | 'deal.event'
  | 'evidence.view'
  | 'evidence.upload'
  | 'supplier.manage'
  | 'assistant.ask'
  | 'memory.retry'
  | 'team.view'
  | 'team.manage'
  | 'settings.manage'
  | 'privacy.export'
  | 'privacy.erase';

export type DealStatus =
  | 'draft'
  | 'quoted'
  | 'agreed'
  | 'part_delivered'
  | 'delivered'
  | 'issue_open'
  | 'resolved'
  | 'cancelled';

export type DealEventType =
  | 'quote_received'
  | 'terms_agreed'
  | 'delivery_checked'
  | 'issue_opened'
  | 'resolution_recorded'
  | 'correction'
  | 'note_added';

export type MemoryStatus = 'pending' | 'active' | 'degraded' | 'revoked';

export type MemoryCustodyMode = 'service_managed' | 'retailer_controlled';

export type MemorySyncStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'superseded'
  | 'deletion_pending';

export type EvidenceExtractionStatus =
  | 'not_requested'
  | 'pending'
  | 'suggested'
  | 'confirmed'
  | 'rejected'
  | 'failed';

export type DataRequestType = 'export' | 'erasure';

export type DataRequestStatus =
  | 'received'
  | 'awaiting_owner_authorisation'
  | 'in_progress'
  | 'verifying'
  | 'complete'
  | 'blocked';

export type DataRequestScope = 'relational' | 'evidence_objects' | 'walrus_memory' | 'derived_text';

export interface Profile {
  id: string;
  display_name: string | null;
  preferred_locale: string;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  owner_user_id: string;
  name: string;
  market_area: string | null;
  country_code: string;
  currency_code: string;
  timezone: string;
  walrus_account_id: string | null;
  walrus_namespace: string | null;
  walrus_owner_address: string | null;
  walrus_delegate_key_ref: string | null;
  memory_custody_mode: MemoryCustodyMode;
  memory_status: MemoryStatus;
  memory_status_detail: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ShopMembership {
  id: string;
  shop_id: string;
  user_id: string;
  role: ShopRole;
  permissions: ShopPermission[];
  invited_by: string | null;
  joined_at: string;
  revoked_at: string | null;
}

export interface Supplier {
  id: string;
  shop_id: string;
  display_name: string;
  phone: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface Deal {
  id: string;
  shop_id: string;
  supplier_id: string;
  status: DealStatus;
  deal_date: string;
  expected_delivery_at: string | null;
  delivery_note: string | null;
  external_reference: string | null;
  currency_code: string;
  headline: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface DealLine {
  id: string;
  shop_id: string;
  deal_id: string;
  product_id: string | null;
  product_label_snapshot: string;
  quoted_quantity: number | null;
  agreed_quantity: number | null;
  received_quantity: number | null;
  unit_label: string | null;
  quoted_unit_price: number | null;
  agreed_unit_price: number | null;
  currency_code: string;
  created_at: string;
  updated_at: string;
}

export interface DealEvent {
  id: string;
  shop_id: string;
  deal_id: string;
  event_type: DealEventType;
  occurred_at: string;
  recorded_at: string;
  summary: string;
  quoted_total: number | null;
  agreed_total: number | null;
  received_total: number | null;
  currency_code: string | null;
  issue_type: string | null;
  condition: string | null;
  resolution_outcome: string | null;
  outcome_code: string | null;
  created_by: string;
  supersedes_event_id: string | null;
  superseded_at: string | null;
}

export interface EvidenceFile {
  id: string;
  shop_id: string;
  deal_id: string;
  event_id: string | null;
  storage_object_key: string;
  content_type: string;
  byte_size: number;
  sha256: string | null;
  original_filename: string;
  uploaded_by: string;
  uploaded_at: string;
  extraction_status: EvidenceExtractionStatus;
  extracted_text_redacted: string | null;
  deleted_at: string | null;
  deleted_object_confirmed_at: string | null;
}

export interface WalrusMemorySync {
  id: string;
  shop_id: string;
  deal_id: string;
  event_id: string;
  memory_blob_id: string | null;
  namespace: string;
  job_id: string | null;
  status: MemorySyncStatus;
  memory_version: number;
  supersedes_sync_id: string | null;
  memory_text: string | null;
  attempt_count: number;
  last_error_code: string | null;
  last_error_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantSession {
  id: string;
  shop_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  last_message_at: string;
  archived_at: string | null;
}

export interface AssistantMessage {
  id: string;
  shop_id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  grounded: boolean;
  source_event_ids: string[];
  source_evidence_ids: string[];
  memory_status: string | null;
  created_at: string;
}

export interface DataRequest {
  id: string;
  shop_id: string;
  requested_by: string;
  request_type: DataRequestType;
  scope: DataRequestScope;
  status: DataRequestStatus;
  walrus_blob_ids: string[];
  detail: string | null;
  blocked_reason: string | null;
  result_object_key: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface AuditEvent {
  id: string;
  shop_id: string | null;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** A deal joined with the fields the register and overview lists need. */
export interface DealListItem {
  id: string;
  shop_id: string;
  status: DealStatus;
  deal_date: string;
  headline: string | null;
  currency_code: string;
  updated_at: string;
  supplier_id: string;
  supplier_name: string;
  last_event_at: string | null;
  last_event_summary: string | null;
  line_count: number;
}

/** A recalled source, resolved to a canonical row inside the authorised shop. */
export interface RecallSource {
  eventId: string;
  dealId: string;
  supplierName: string;
  eventType: DealEventType;
  occurredAt: string;
  summary: string;
  headline: string | null;
  dealDate: string;
  currencyCode: string;
  lines: Array<{
    productLabel: string;
    quotedQuantity: number | null;
    agreedQuantity: number | null;
    receivedQuantity: number | null;
    unitLabel: string | null;
    quotedUnitPrice: number | null;
    agreedUnitPrice: number | null;
  }>;
  evidence: Array<{
    id: string;
    originalFilename: string;
    contentType: string;
    uploadedAt: string;
  }>;
}