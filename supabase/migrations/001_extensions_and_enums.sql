-- ==============================================================================
-- Migration: 001_extensions_and_enums.sql
-- Description: Initialize PostgreSQL extensions and custom enumerated types.
-- Target: Run in Supabase SQL Editor
-- ==============================================================================

-- Enable UUID extension and cryptographic utilities
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Transaction Types for Double-Entry style Wallet Ledger
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'CREDIT',
        'DEBIT',
        'RESERVE',
        'RELEASE',
        'CLAIM',
        'REFUND',
        'WITHDRAWAL',
        'WITHDRAWAL_REVERSAL',
        'FEE'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Transaction Status
DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM (
        'PENDING',
        'SUCCESS',
        'FAILED',
        'REVERSED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Lifafa Status Lifecycle
DO $$ BEGIN
    CREATE TYPE lifafa_status AS ENUM (
        'DRAFT',
        'ACTIVE',
        'PAUSED',
        'COMPLETED',
        'EXPIRED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Distribution Mode
DO $$ BEGIN
    CREATE TYPE distribution_type AS ENUM (
        'EQUAL',
        'RANDOM'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Task Types for Lifafa Claim Requirements
DO $$ BEGIN
    CREATE TYPE task_type AS ENUM (
        'TELEGRAM_JOIN',
        'YOUTUBE_SUB',
        'REFERRAL',
        'INSTAGRAM_FOLLOW',
        'INSTAGRAM_LIKE',
        'TELEGRAM_BOT',
        'VISIT_WEBSITE',
        'CUSTOM'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Withdrawal Payout Lifecycle
DO $$ BEGIN
    CREATE TYPE withdrawal_status AS ENUM (
        'PENDING',
        'PROCESSING',
        'SUCCESS',
        'FAILED',
        'REVERSED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Admin Permission Roles
DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM (
        'SUPER_ADMIN',
        'ADMIN',
        'SUPPORT'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Platform Fee Calculation Mode
DO $$ BEGIN
    CREATE TYPE fee_calculation_type AS ENUM (
        'PERCENTAGE',
        'FIXED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Fraud Flag Severity
DO $$ BEGIN
    CREATE TYPE fraud_severity AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
