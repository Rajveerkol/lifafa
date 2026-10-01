-- ==============================================================================
-- Migration: 034_add_youtube_watch_enum.sql (Migration A)
-- Description: Step 1 of Watch YouTube Video Requirement
--              Add 'YOUTUBE_WATCH' to public.task_type enum ONLY.
--
-- IMPORTANT (PostgreSQL Error 55P04 Resolution):
-- PostgreSQL requires newly added enum values via ALTER TYPE ... ADD VALUE
-- to be completely committed before they can be referenced by subsequent SQL
-- (such as columns, indexes, or PL/pgSQL functions) in subsequent transactions.
-- This migration contains NO SQL referencing 'YOUTUBE_WATCH' after ALTER TYPE.
--
-- Target: Supabase SQL Editor / Management API
-- Execute and COMMIT this file completely BEFORE running Migration B (035).
-- ==============================================================================

ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'YOUTUBE_WATCH';
