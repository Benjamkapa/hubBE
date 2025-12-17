import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const checkProfiles = async () => {
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

    // Get all profiles
    const [profileRows] = await connection.execute(
      "SELECT id, display_name, phone, email FROM profiles WHERE deleted_at IS NULL"
    );

    coproceednsole.log("📋 Profiles found:");
    for (const profile of profileRows) {
      console.log(
        `   ID: ${profile.id}, Name: ${profile.display_name}, Phone: ${profile.phone}, Email: ${profile.email}`
      );
    }

    // Get services and their owners
    const [serviceRows] = await connection.execute(
      "SELECT id, title, owner_id FROM services WHERE deleted_at IS NULL"
    );

    console.log("\n📋 Services and owners:");
    for (const service of serviceRows) {
      const owner = profileRows.find((p) => p.id === service.owner_id);
      console.log(
        `   Service ID: ${service.id}, Title: ${service.title}, Owner ID: ${
          service.owner_id
        }, Owner Name: ${owner ? owner.display_name : "N/A"}, Phone: ${
          owner ? owner.phone : "N/A"
        }, Email: ${owner ? owner.email : "N/A"}`
      );
    }
  } catch (error) {
    console.error("❌ Error checking profiles:", error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed.");
    }
  }
};

// Run the check function
checkProfiles()
  .then(() => {
    console.log("✅ Check completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Check failed!");
    process.exit(1);
  });
