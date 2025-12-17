import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const updateByName = async () => {
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

    // Update profiles by name
    const updates = [
      {
        name: "Rita SARANGE",
        phone: "+254712345678",
        email: "rita.sarange@example.com",
      },
      {
        name: "okombe mabenjo",
        phone: "+254798765432",
        email: "okombe.mabenjo@example.com",
      },
    ];

    for (const update of updates) {
      const [result] = await connection.execute(
        "UPDATE profiles SET phone = ?, email = ? WHERE display_name = ?",
        [update.phone, update.email, update.name]
      );

      if (result.affectedRows > 0) {
        console.log(`✅ Updated profile for "${update.name}"`);
        console.log(`   📱 Phone: ${update.phone}`);
        console.log(`   📧 Email: ${update.email}`);
      } else {
        console.log(`⚠️ No profile found for "${update.name}"`);
      }
    }
  } catch (error) {
    console.error("❌ Error updating profiles:", error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed.");
    }
  }
};

// Run the update function
updateByName()
  .then(() => {
    console.log("✅ Update completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Update failed!");
    process.exit(1);
  });
