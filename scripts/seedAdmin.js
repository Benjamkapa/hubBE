// scripts/seedAdmin.js

import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const seedAdmin = async () => {
  let connection;

  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "hudumahub",
    });

    console.log("✅ Connected to database.");

    // Admin credentials from environment variables or defaults
    const adminEmail = process.env.ADMIN_EMAIL ;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminPhone = process.env.ADMIN_PHONE;
    const adminName = process.env.ADMIN_NAME;

    // Check if admin already exists
    const [existingAdmin] = await connection.execute(
      "SELECT id, email, role FROM profiles WHERE email = ? OR role = ?",
      [adminEmail, "admin"]
    );

    if (existingAdmin.length > 0) {
      console.log("⚠️ Admin user already exists:");
      console.log("   ID:", existingAdmin[0].id);
      console.log("   Email:", existingAdmin[0].email);
      console.log("   Role:", existingAdmin[0].role);
      console.log("");
      console.log(
        "ℹ️  If you want to reset the admin, delete the existing admin first:"
      );
      console.log(`   DELETE FROM profiles WHERE id = ${existingAdmin[0].id};`);
      return;
    }

    console.log("🔐 Hashing password...");
    // Hash password with bcrypt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    console.log("📝 Inserting admin user...");
    // Insert admin user (id will be auto-generated)
    const [result] = await connection.execute(
      `INSERT INTO profiles 
       (email, password_hash, display_name, phone, role, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        adminEmail,
        passwordHash,
        adminName,
        adminPhone,
        "admin",
        1, // email_verified = true
      ]
    );

    console.log("");
    console.log("✅ Admin user created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📋 Admin Details:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🆔 ID:", result.insertId);
    console.log("📧 Email:", adminEmail);
    console.log("🔑 Password:", adminPassword);
    console.log("👤 Name:", adminName);
    console.log("📱 Phone:", adminPhone);
    console.log("👑 Role: admin");
    console.log("✅ Email Verified: Yes");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("⚠️  IMPORTANT: Please change the password after first login!");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("❌ Error seeding admin:", error.message);

    if (error.code === "ER_DUP_ENTRY") {
      console.error("");
      console.error(
        "ℹ️  This error means a user with this email already exists."
      );
      console.error("   Check your database or use a different email.");
    } else if (error.code === "ECONNREFUSED") {
      console.error("");
      console.error("ℹ️  Cannot connect to database. Please check:");
      console.error("   1. MySQL server is running");
      console.error("   2. Database credentials in .env file");
      console.error("   3. Database exists");
    } else if (error.code === "ER_BAD_DB_ERROR") {
      console.error("");
      console.error("ℹ️  Database does not exist. Please create it first:");
      console.error(
        `   CREATE DATABASE ${process.env.DB_NAME || "hudumahub"};`
      );
    }

    console.error("");
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed.");
    }
  }
};

// Run the seeding function
seedAdmin()
  .then(() => {
    console.log("✅ Seeding completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed!");
    process.exit(1);
  });
