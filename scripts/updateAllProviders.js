import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const updateAllProviders = async () => {
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

    // Get all services and their owners
    const [serviceRows] = await connection.execute(
      "SELECT id, title, owner_id FROM services WHERE deleted_at IS NULL"
    );

    console.log("📋 Services found:");
    for (const service of serviceRows) {
      console.log(
        `   ID: ${service.id}, Title: ${service.title}, Owner ID: ${service.owner_id}`
      );
    }

    // Update profiles for all service owners with sample data
    const sampleData = [
      {
        serviceId: 1,
        phone: "+254712345678",
        email: "rita.sarange@example.com",
      },
      {
        serviceId: 3,
        phone: "+254798765432",
        email: "okombe.mabenjo@example.com",
      },
      // Add more as needed
    ];

    for (const data of sampleData) {
      const service = serviceRows.find((s) => s.id === data.serviceId);
      if (service) {
        const [result] = await connection.execute(
          "UPDATE profiles SET phone = ?, email = ? WHERE id = ?",
          [data.phone, data.email, service.owner_id]
        );

        if (result.affectedRows > 0) {
          console.log(
            `✅ Updated profile for service "${service.title}" (ID: ${data.serviceId})`
          );
          console.log(`   📱 Phone: ${data.phone}`);
          console.log(`   📧 Email: ${data.email}`);
        } else {
          console.log(
            `⚠️ No profile updated for service "${service.title}". Owner might not exist.`
          );
        }
      }
    }
  } catch (error) {
    console.error("❌ Error updating providers:", error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed.");
    }
  }
};

// Run the update function
updateAllProviders()
  .then(() => {
    console.log("✅ Update completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Update failed!");
    process.exit(1);
  });
