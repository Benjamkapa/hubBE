-- Migration: Alter services table to add health category, increase delivery_fee precision, and add missing indexes

-- Add 'health' to category enum
ALTER TABLE services MODIFY COLUMN category ENUM('shop', 'cleaning', 'shopping', 'transport', 'repair', 'other', 'services', 'health') NOT NULL;

-- Increase delivery_fee precision to handle larger values
ALTER TABLE services MODIFY COLUMN delivery_fee DECIMAL(15, 2) DEFAULT 0.00;

-- Change owner_id to VARCHAR to match application logic
ALTER TABLE services MODIFY COLUMN owner_id VARCHAR(255) NOT NULL;

-- Add missing indexes for better performance
ALTER TABLE services ADD INDEX idx_category (category);
ALTER TABLE services ADD INDEX idx_owner_id (owner_id);
ALTER TABLE services ADD INDEX idx_status (status);
ALTER TABLE services ADD INDEX idx_deleted_at (deleted_at);
