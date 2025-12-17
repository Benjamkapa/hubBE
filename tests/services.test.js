const request = require("supertest");
const express = require("express");
const servicesRouter = require("../src/routes/services");
const { pool } = require("../src/config/db");

// Mock the database pool
jest.mock("../src/config/db", () => ({
  pool: {
    execute: jest.fn(),
  },
}));

// Mock middleware
jest.mock("../src/middleware/auth", () => ({
  requireAuth: (req, res, next) => {
    req.user = { userId: "test-user-id", role: "service_provider" };
    next();
  },
  AuthRequest: jest.fn(),
}));

jest.mock("../src/middleware/roles", () => ({
  requireRole: () => (req, res, next) => next(),
}));

const app = express();
app.use(express.json());
app.use("/api/services", servicesRouter);

describe("Services API Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/services", () => {
    it("should return paginated services list", async () => {
      const mockServices = [
        {
          id: 1,
          slug: "test-service",
          title: "Test Service",
          description: "A test service",
          category: "cleaning",
          status: "active",
          delivery_fee: 100,
          color: "blue",
          bg_color: "blue-100",
          color_hex: "#3B82F6",
          image: "https://example.com/image.jpg",
          fields: JSON.stringify([
            { name: "name", label: "Name", type: "text", required: true },
          ]),
          owner_id: "owner-123",
          owner_name: "Test Owner",
          latitude: -1.2864,
          longitude: 36.8172,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ];

      pool.execute
        .mockResolvedValueOnce([mockServices]) // services query
        .mockResolvedValueOnce([{ total: 1 }]); // count query

      const response = await request(app)
        .get("/api/services")
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("services");
      expect(response.body).toHaveProperty("pagination");
      expect(response.body.services).toHaveLength(1);
      expect(response.body.services[0].title).toBe("Test Service");
    });

    it("should filter services by category", async () => {
      const mockServices = [
        {
          id: 1,
          slug: "cleaning-service",
          title: "Cleaning Service",
          description: "Professional cleaning",
          category: "cleaning",
          status: "active",
          delivery_fee: 150,
          color: "green",
          bg_color: "green-100",
          color_hex: "#10B981",
          image: "https://example.com/cleaning.jpg",
          fields: JSON.stringify([]),
          owner_id: "owner-456",
          owner_name: "Clean Co",
          latitude: null,
          longitude: null,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ];

      pool.execute
        .mockResolvedValueOnce([mockServices])
        .mockResolvedValueOnce([{ total: 1 }]);

      const response = await request(app)
        .get("/api/services")
        .query({ category: "cleaning" });

      expect(response.status).toBe(200);
      expect(response.body.services[0].category).toBe("cleaning");
    });

    it("should handle invalid pagination parameters", async () => {
      const response = await request(app)
        .get("/api/services")
        .query({ page: 0, limit: -1 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid pagination parameters");
    });
  });

  describe("GET /api/services/:slug", () => {
    it("should return service by slug", async () => {
      const mockService = {
        id: 1,
        slug: "house-cleaning-service",
        title: "House Cleaning Service",
        description: "Professional house cleaning",
        category: "cleaning",
        status: "active",
        delivery_fee: 200,
        color: "blue",
        bg_color: "blue-100",
        color_hex: "#3B82F6",
        image: "https://example.com/cleaning.jpg",
        fields: JSON.stringify([
          { name: "name", label: "Full Name", type: "text", required: true },
          {
            name: "email",
            label: "Email Address",
            type: "text",
            required: true,
          },
          {
            name: "phone",
            label: "Phone Number",
            type: "text",
            required: true,
          },
          { name: "location", label: "Location", type: "text", required: true },
        ]),
        owner_id: "owner-789",
        owner_name: "Clean Masters Ltd",
        latitude: -1.2864,
        longitude: 36.8172,
        created_at: "2024-01-01T00:00:00.000Z",
      };

      pool.execute.mockResolvedValueOnce([[mockService]]);

      const response = await request(app).get(
        "/api/services/house-cleaning-service"
      );

      expect(response.status).toBe(200);
      expect(response.body.service.slug).toBe("house-cleaning-service");
      expect(response.body.service.fields).toEqual([
        { name: "name", label: "Full Name", type: "text", required: true },
        { name: "email", label: "Email Address", type: "text", required: true },
        { name: "phone", label: "Phone Number", type: "text", required: true },
        { name: "location", label: "Location", type: "text", required: true },
      ]);
    });
  });

  describe("POST /api/services", () => {
    it("should create a new service", async () => {
      const newServiceData = {
        title: "New Cleaning Service",
        description: "Professional cleaning services",
        category: "cleaning",
        delivery_fee: 150,
        color: "green",
        bg_color: "green-100",
        color_hex: "#10B981",
        image: "https://example.com/new-service.jpg",
        fields: [
          { name: "name", label: "Full Name", type: "text", required: true },
          {
            name: "email",
            label: "Email Address",
            type: "text",
            required: true,
          },
        ],
        owner_name: "New Owner",
        latitude: -1.2864,
        longitude: 36.8172,
      };

      // Mock slug uniqueness check
      pool.execute
        .mockResolvedValueOnce([[]]) // No existing slug
        .mockResolvedValueOnce([{ insertId: 123 }]); // Insert result

      const response = await request(app)
        .post("/api/services")
        .send(newServiceData);

      expect(response.status).toBe(201);
      expect(response.body.service.title).toBe("New Cleaning Service");
      expect(response.body.service.slug).toBe("new-cleaning-service");
      expect(response.body.service.owner_id).toBe("test-user-id");
    });

    it("should validate required fields", async () => {
      const invalidData = {
        title: "", // Empty title
        category: "invalid_category",
        image: "",
        owner_name: "",
      };

      const response = await request(app)
        .post("/api/services")
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("errors");
    });

    it("should handle duplicate slug", async () => {
      const serviceData = {
        title: "Test Service",
        description: "A test service",
        category: "cleaning",
        image: "https://example.com/image.jpg",
        owner_name: "Test Owner",
      };

      pool.execute.mockResolvedValueOnce([[{ id: 1 }]]); // Existing slug found

      const response = await request(app)
        .post("/api/services")
        .send(serviceData);

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("Slug already exists");
    });
  });

  describe("PUT /api/services/:id", () => {
    it("should update service successfully", async () => {
      const updateData = {
        title: "Updated Service Title",
        description: "Updated description",
        delivery_fee: 250,
      };

      // Mock service ownership check
      pool.execute
        .mockResolvedValueOnce([
          [{ owner_id: "test-user-id", title: "Old Title" }],
        ])
        .mockResolvedValueOnce([]); // Update query

      const response = await request(app)
        .put("/api/services/1")
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Service updated successfully");
    });

    it("should prevent unauthorized updates", async () => {
      // Mock different owner
      pool.execute.mockResolvedValueOnce([
        [{ owner_id: "different-owner-id", title: "Service" }],
      ]);

      const response = await request(app)
        .put("/api/services/1")
        .send({ title: "New Title" });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Forbidden");
    });
  });

  describe("DELETE /api/services/:id", () => {
    it("should soft delete service", async () => {
      // Mock ownership and no existing orders
      pool.execute
        .mockResolvedValueOnce([[{ owner_id: "test-user-id" }]])
        .mockResolvedValueOnce([[]]) // No orders
        .mockResolvedValueOnce([]); // Delete query

      const response = await request(app).delete("/api/services/1");

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Service deleted successfully");
    });

    it("should prevent deletion with existing orders", async () => {
      pool.execute
        .mockResolvedValueOnce([[{ owner_id: "test-user-id" }]])
        .mockResolvedValueOnce([[{ id: 1 }]]); // Has orders

      const response = await request(app).delete("/api/services/1");

      expect(response.status).toBe(409);
      expect(response.body.error).toBe(
        "Cannot delete service with existing orders"
      );
    });
  });

  describe("GET /api/services/categories", () => {
    it("should return unique categories", async () => {
      const mockCategories = [
        { category: "cleaning" },
        { category: "shopping" },
        { category: "transport" },
      ];

      pool.execute.mockResolvedValueOnce([mockCategories]);

      const response = await request(app).get("/api/services/categories");

      expect(response.status).toBe(200);
      expect(response.body.categories).toEqual([
        "cleaning",
        "shopping",
        "transport",
      ]);
    });
  });

  describe("GET /api/services/search", () => {
    it("should search services by query", async () => {
      const mockResults = [
        {
          id: 1,
          slug: "cleaning-service",
          title: "Professional Cleaning",
          description: "House cleaning services",
          category: "cleaning",
          status: "active",
          delivery_fee: 100,
          color: "blue",
          bg_color: "blue-100",
          color_hex: "#3B82F6",
          image: "https://example.com/cleaning.jpg",
          fields: JSON.stringify([]),
          owner_id: "owner-123",
          owner_name: "Clean Co",
          latitude: null,
          longitude: null,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ];

      pool.execute
        .mockResolvedValueOnce([mockResults])
        .mockResolvedValueOnce([{ total: 1 }]);

      const response = await request(app)
        .get("/api/services/search")
        .query({ q: "cleaning" });

      expect(response.status).toBe(200);
      expect(response.body.services).toHaveLength(1);
      expect(response.body.services[0].title).toBe("Professional Cleaning");
    });

    it("should require search query", async () => {
      const response = await request(app).get("/api/services/search");

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Search query is required");
    });
  });

  describe("PUT /api/services/:id/status", () => {
    it("should update service status (admin only)", async () => {
      // Mock admin user
      const originalRequireAuth = require("../src/middleware/auth").requireAuth;
      require("../src/middleware/auth").requireAuth = (req, res, next) => {
        req.user = { userId: "admin-id", role: "admin" };
        next();
      };

      pool.execute
        .mockResolvedValueOnce([[{ id: 1 }]]) // Service exists
        .mockResolvedValueOnce([]); // Status update

      const response = await request(app)
        .put("/api/services/1/status")
        .send({ status: "inactive" });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Service status updated successfully");

      // Restore original mock
      require("../src/middleware/auth").requireAuth = originalRequireAuth;
    });
  });
});
