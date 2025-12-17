import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const updateProvider = async () => {
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

    // Find the owner_id for service ID 1
    const [serviceRows] = await connection.execute(
      "SELECT owner_id FROM services WHERE id = ?",
      [1]
    );

    if (serviceRows.length === 0) {
      console.log("❌ Service with ID 1 not found");
      return;
    }

    const ownerId = serviceRows[0].owner_id;
    console.log(`📋 Found owner_id: ${ownerId} for service ID 1`);

    // Update the profile with phone and email
    const [result] = await connection.execute(
      "UPDATE profiles SET phone = ?, email = ? WHERE id = ?",
      ["+254712345678", "rita.sarange@example.com", ownerId]
    );

    if (result.affectedRows > 0) {
      console.log("✅ Provider profile updated successfully!");
      console.log("📱 Phone: +254712345678");
      console.log("📧 Email: rita.sarange@example.com");
    } else {
      console.log("⚠️ No profile updated. Owner might not exist.");
    }
  } catch (error) {
    console.error("❌ Error updating provider:", error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed.");
    }
  }
};

// Run the update function
updateProvider()
  .then(() => {
    console.log("✅ Update completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Update failed!");
    process.exit(1);
  });
