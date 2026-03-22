const mongoose = require("mongoose");
const Product = require("../models/product.model");

function sendSuccess(res, message, data, statusCode) {
  return res.status(statusCode || 200).json({
    success: true,
    message: message,
    data: data
  });
}

function sendError(res, message, statusCode, errors) {
  return res.status(statusCode || 400).json({
    success: false,
    message: message,
    errors: errors || null
  });
}

function formatValidationError(error) {
  if (error && error.name === "ValidationError") {
    return Object.keys(error.errors).map(function (key) {
      return {
        field: key,
        message: error.errors[key].message
      };
    });
  }

  return null;
}

function normalizePagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100);
  return {
    page: page,
    limit: limit,
    skip: (page - 1) * limit
  };
}

function pickProductPayload(body) {
  const payload = {};

  if (body.name !== undefined) {
    payload.name = String(body.name).trim();
  }

  if (body.price !== undefined) {
    payload.price = Number(body.price);
  }

  if (body.flowGB !== undefined) {
    payload.flowGB = Number(body.flowGB);
  }

  if (body.validDays !== undefined) {
    payload.validDays = Number(body.validDays);
  }

  if (body.isRecommended !== undefined) {
    payload.isRecommended = Boolean(body.isRecommended);
  }

  if (body.stock !== undefined) {
    payload.stock = body.stock === null || body.stock === "" ? null : Number(body.stock);
  }

  return payload;
}

async function getProducts(req, res) {
  try {
    const { page, limit, skip } = normalizePagination(req.query);
    const total = await Product.countDocuments();
    const products = await Product.find()
      .sort({ isRecommended: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendSuccess(
      res,
      "获取商品列表成功",
      {
        items: products,
        pagination: {
          page: page,
          limit: limit,
          total: total,
          totalPages: Math.max(Math.ceil(total / limit), 1)
        }
      }
    );
  } catch (error) {
    console.error(error);
    return sendError(res, "获取商品列表失败", 500);
  }
}

async function getProductById(req, res) {
  try {
    const productId = req.params.id;

    if (!mongoose.isValidObjectId(productId)) {
      return sendError(res, "商品 ID 格式不正确", 400);
    }

    const product = await Product.findById(productId);

    if (!product) {
      return sendError(res, "商品不存在", 404);
    }

    return sendSuccess(res, "获取商品详情成功", product);
  } catch (error) {
    console.error(error);
    return sendError(res, "获取商品详情失败", 500);
  }
}

async function createProduct(req, res) {
  try {
    const payload = pickProductPayload(req.body);
    const product = await Product.create(payload);

    return sendSuccess(res, "创建商品成功", product, 201);
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return sendError(res, "商品数据校验失败", 400, formatValidationError(error));
    }

    return sendError(res, "创建商品失败", 500);
  }
}

async function updateProduct(req, res) {
  try {
    const productId = req.params.id;

    if (!mongoose.isValidObjectId(productId)) {
      return sendError(res, "商品 ID 格式不正确", 400);
    }

    const payload = pickProductPayload(req.body);
    const product = await Product.findByIdAndUpdate(productId, payload, {
      new: true,
      runValidators: true
    });

    if (!product) {
      return sendError(res, "商品不存在", 404);
    }

    return sendSuccess(res, "更新商品成功", product);
  } catch (error) {
    console.error(error);

    if (error.name === "ValidationError") {
      return sendError(res, "商品数据校验失败", 400, formatValidationError(error));
    }

    return sendError(res, "更新商品失败", 500);
  }
}

async function deleteProduct(req, res) {
  try {
    const productId = req.params.id;

    if (!mongoose.isValidObjectId(productId)) {
      return sendError(res, "商品 ID 格式不正确", 400);
    }

    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      return sendError(res, "商品不存在", 404);
    }

    return sendSuccess(res, "删除商品成功", {
      id: product.id
    });
  } catch (error) {
    console.error(error);
    return sendError(res, "删除商品失败", 500);
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
