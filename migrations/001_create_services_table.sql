-- Migration: Create services table
-- This table stores service information with dynamic fields stored as JSON

CREATE TABLE services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category ENUM('shop', 'cleaning', 'shopping', 'transport', 'repair', 'other', 'services', 'health') NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    delivery_fee DECIMAL(15, 2) DEFAULT 0.00,
    color VARCHAR(50),
    bg_color VARCHAR(50),
    color_hex VARCHAR(7),
    image TEXT, -- Single image URL
    fields JSON, -- Dynamic fields stored as JSON array
    owner_id VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_slug (slug),
    INDEX idx_category (category),
    INDEX idx_owner_id (owner_id),
    INDEX idx_status (status),
    INDEX idx_deleted_at (deleted_at)
);










CREATE TABLE `services` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `category` enum('shop','cleaning','shopping','transport','repair','other','services','health') NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `delivery_fee` decimal(15,2) DEFAULT '0.00',
  `color` varchar(50) DEFAULT NULL,
  `bg_color` varchar(50) DEFAULT NULL,
  `color_hex` varchar(7) DEFAULT NULL,
  `image` text,
  `fields` json DEFAULT NULL,
  `owner_id` varchar(255) NOT NULL,
  `owner_name` varchar(255) NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_category` (`category`),
  KEY `idx_owner_id` (`owner_id`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
