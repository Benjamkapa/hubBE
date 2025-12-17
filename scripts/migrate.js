const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hudumahub",
    multipleStatements: true,
  });

  try {
    // Get all migration files
    const migrationsDir = path.join(__dirname, "..", "migrations");
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith(".sql")) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

        // Split by semicolon and execute each statement
        const statements = sql
          .split(";")
          .filter((stmt) => stmt.trim().length > 0);

        for (const statement of statements) {
          if (statement.trim()) {
            await connection.execute(statement);
          }
        }

        console.log(`✅ Migration ${file} completed`);
      }
    }

    console.log("🎉 All migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
