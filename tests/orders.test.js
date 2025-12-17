import request from "supertest";
import { jest } from "@jest/globals";
import app from "../src/index.js"; // Adjust path as needed

describe("Orders Endpoints", () => {
  let accessToken;

  beforeAll(async () => {
    // Sign in to get access token
    const signinResponse = await request(app).post("/api/auth/signin").send({
      email: "admin@hudumahub.com",
      password: "ChangeThisPassword123!",
    });

    accessToken = signinResponse.body.accessToken;
  });

  describe("POST /api/orders/anonymous", () => {
    it("should create anonymous order successfully", async () => {
      const response = await request(app).post("/api/orders/anonymous").send({
        serviceId: 1, // Assuming service exists
        quantity: 1,
        anonymousName: "Test Customer",
        anonymousEmail: "customer@example.com",
        anonymousPhone: "+1234567890",
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("orderId");
      expect(response.body).toHaveProperty("totalAmount");
    });

    it("should return 400 for invalid input", async () => {
      const response = await request(app).post("/api/orders/anonymous").send({
        serviceId: 1,
        quantity: 1,
        // Missing required fields
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/orders/my", () => {
    it("should return user orders", async () => {
      const response = await request(app)
        .get("/api/orders/my")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("orders");
      expect(Array.isArray(response.body.orders)).toBe(true);
    });
  });
});
