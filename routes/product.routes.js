const express = require("express");
const productController = require("../controllers/product.controller");

function createProductRoutes(middlewares) {
  const router = express.Router();
  const authenticateRequest = middlewares.authenticateRequest;
  const requireAdmin = middlewares.requireAdmin;

  router.get("/", productController.getProducts);
  router.get("/:id", productController.getProductById);
  router.post("/", authenticateRequest, requireAdmin, productController.createProduct);
  router.put("/:id", authenticateRequest, requireAdmin, productController.updateProduct);
  router.delete("/:id", authenticateRequest, requireAdmin, productController.deleteProduct);

  return router;
}

module.exports = createProductRoutes;
