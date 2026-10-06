-- ==============================================================================
-- Migration: 064_production_audit_remediation.sql
-- Description: Production Security Hardening & Audit Findings Remediation
-- Targets:
--   1. Harden SECURITY DEFINER search_path on Phase 6 Enterprise RPCs
--   2. Explicitly bind search_path = public, pg_temp to prevent schema hijacking
--
-- SQL EXECUTED BY ANTIGRAVITY: NO
-- SQL REQUIRES MANUAL EXECUTION: YES
-- ==============================================================================

-- 1. Authoritative Enterprise Access Checker
ALTER FUNCTION public.check_enterprise_bot_access(UUID)
    SET search_path = public, pg_temp;

-- 2. Create / Update Enterprise Workflow Journey RPC
ALTER FUNCTION public.save_enterprise_journey_rpc(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB)
    SET search_path = public, pg_temp;

-- 3. Enqueue Workflow Job RPC
ALTER FUNCTION public.enqueue_workflow_job_rpc(UUID, UUID, UUID, BIGINT, JSONB, INT)
    SET search_path = public, pg_temp;

-- 4. Get Enterprise Command Center Real Telemetry Metrics RPC
ALTER FUNCTION public.get_enterprise_command_center_metrics_rpc(UUID)
    SET search_path = public, pg_temp;

-- 5. Generate Scheduled Report RPC
ALTER FUNCTION public.generate_bot_scheduled_report_rpc(UUID, TEXT)
    SET search_path = public, pg_temp;

-- ==============================================================================
-- POST-EXECUTION VERIFICATION QUERY (Run in Supabase SQL Editor to verify):
-- ==============================================================================
-- SELECT proname, prosecdef, proconfig 
-- FROM pg_proc 
-- WHERE proname IN (
--   'check_enterprise_bot_access',
--   'save_enterprise_journey_rpc',
--   'enqueue_workflow_job_rpc',
--   'get_enterprise_command_center_metrics_rpc',
--   'generate_bot_scheduled_report_rpc'
-- );
--
-- Expected Output:
-- Each row will have prosecdef = true and proconfig = {search_path=public, pg_temp}
