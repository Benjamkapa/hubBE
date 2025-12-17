const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "hudumahub",
    });

    console.log("Connected to database");

    const [admins] = await conn.execute(
      'SELECT id, email, role, deleted_at FROM profiles WHERE role = "admin"'
    );
    console.log("Admin users:", admins);

    const [all] = await conn.execute(
      "SELECT id, email, role, deleted_at FROM profiles LIMIT 10"
    );
    console.log("All users:", all);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (conn) await conn.end();
  }
})();
