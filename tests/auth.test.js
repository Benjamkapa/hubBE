import request from "supertest";
import { jest } from "@jest/globals";
import app from "../src/index.js"; // Adjust path as needed

describe("Authentication Endpoints", () => {
  beforeAll(async () => {
    // Setup test database or mock if needed
  });

  afterAll(async () => {
    // Cleanup
  });

  describe("POST /api/auth/signin", () => {
    it("should return 200 and tokens for valid credentials", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        email: "admin@hudumahub.com",
        password: "ChangeThisPassword123!",
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });

    it("should return 401 for invalid credentials", async () => {
      const response = await request(app).post("/api/auth/signin").send({
        email: "invalid@example.com",
        password: "wrongpassword",
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should return new tokens for valid refresh token", async () => {
      // First sign in to get tokens
      const signinResponse = await request(app).post("/api/auth/signin").send({
        email: "admin@hudumahub.com",
        password: "ChangeThisPassword123!",
      });

      const refreshToken = signinResponse.body.refreshToken;

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });
  });
});
