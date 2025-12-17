import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const checkOrder = async () => {
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

    const orderId = "b183e90f-aee4-49fb-8155-73b1fd24538b";

    // Run the same query as the API
    const [rows] = await connection.query(
      `
      SELECT o.id, o.anonymous_name, o.anonymous_email, o.anonymous_phone, o.total_amount, o.status, o.payment_status, o.created_at,
             oi.service_id, oi.quantity, oi.price,
             s.title as service_title, s.slug as service_slug, s.owner_name, s.image,
             p.phone as provider_phone, p.email as provider_email
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN services s ON oi.service_id = s.id
      LEFT JOIN profiles p ON s.owner_id = p.id
      WHERE o.id = ? AND o.deleted_at IS NULL
      `,
      [orderId]
    );

    console.log("📋 Query results:");
    for (const row of rows) {
      console.log(
        `   Service ID: ${row.service_id}, Title: ${row.service_title}, Owner Name: ${row.owner_name}, Provider Phone: ${row.provider_phone}, Provider Email: ${row.provider_email}`
      );
    }
  } catch (error) {
    console.error("❌ Error checking order:", error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("✅ Database connection closed.");
    }
  }
};

// Run the check function
checkOrder()
  .then(() => {
    console.log("✅ Check completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Check failed!");
    process.exit(1);
  });
