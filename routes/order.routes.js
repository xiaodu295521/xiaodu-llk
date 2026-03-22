const express = require("express");
const orderController = require("../controllers/order.controller");

function createOrderRoutes(middlewares) {
  const orderRouter = express.Router();
  const adminRouter = express.Router();
  const authenticateRequest = middlewares.authenticateRequest;
  const requireAdmin = middlewares.requireAdmin;

  orderRouter.post("/", authenticateRequest, orderController.createOrder);
  orderRouter.get("/my", authenticateRequest, orderController.getMyOrders);
  orderRouter.get("/", authenticateRequest, orderController.getMyOrders);
  orderRouter.put("/:id/confirm-payment", authenticateRequest, orderController.confirmPayment);
  orderRouter.patch("/:id/confirm-payment", authenticateRequest, orderController.confirmPayment);
  orderRouter.put("/:id/status", authenticateRequest, orderController.updateOrderStatus);
  orderRouter.patch("/:id/status", authenticateRequest, orderController.updateOrderStatus);

  adminRouter.get("/orders", authenticateRequest, requireAdmin, orderController.getAdminOrders);
  adminRouter.put("/orders/:id/status", authenticateRequest, requireAdmin, orderController.updateOrderStatus);
  adminRouter.patch("/orders/:id/status", authenticateRequest, requireAdmin, orderController.updateOrderStatus);

  return {
    orderRouter,
    adminRouter
  };
}

module.exports = createOrderRoutes;
