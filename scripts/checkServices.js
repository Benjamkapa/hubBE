import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const checkServices = async () => {
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

    // Get all services
    const [serviceRows] = await connection.execute(
      "SELECT id, title, owner_id, owner_name FROM services"
    );

    console.log("📋 Services found:");
    for (const service of serviceRows) {
      console.log(
        `   ID: ${service.id}, Title: ${service.title}, Owner ID: ${service.owner_id}, Owner Name: ${service.owner_name}`
      );
    }

    // Get all profiles
    const [profileRows] = await connection.execute(
      "SELECT id, display_name, phone, email FROM profiles"
    );

    console.log("\n📋 Profiles found:");
    for (const profile of profileRows) {
      console.log(
        `   ID: ${profile.id}, Name: ${profile.display_name}, Phone: ${profile.phone}, Email: ${profile.email}`
      );
    }

    console.log("\n🔗 Matching services to profiles:");
    for (const service of serviceRows) {
      const profile = profileRows.find((p) => p.id === service.owner_id);
      console.log(
        `   Service "${service.title}" (ID: ${service.id}) -> Owner ID: ${
          service.owner_id
        } -> Profile: ${profile ? profile.display_name : "NOT FOUND"}`
      );
    }
  } catch (error) {
    console.error("❌ Error checking services:", error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed.");
    }
  }
};

// Run the check function
checkServices()
  .then(() => {
    console.log("✅ Check completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Check failed!");
    process.exit(1);
  });
