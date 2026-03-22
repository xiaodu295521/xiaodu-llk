const mongoose = require("mongoose");

const ORDER_STATUS = {
  PENDING: "pending",
  PAID_PENDING_CONFIRM: "paid_pending_confirm",
  COMPLETED: "completed"
};

const packageInfoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "套餐名称不能为空"],
      trim: true
    },
    price: {
      type: Number,
      required: [true, "套餐价格不能为空"],
      min: [0, "套餐价格不能小于 0"]
    },
    flowGB: {
      type: Number,
      required: [true, "流量不能为空"],
      min: [0, "流量不能小于 0"]
    },
    validDays: {
      type: Number,
      required: [true, "有效期不能为空"],
      min: [1, "有效期至少 1 天"]
    },
    isRecommended: {
      type: Boolean,
      default: false
    },
    stock: {
      type: Number,
      default: null,
      min: [0, "库存不能小于 0"]
    }
  },
  {
    _id: false
  }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "用户 ID 不能为空"],
      index: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "商品 ID 不能为空"],
      index: true
    },
    packageInfo: {
      type: packageInfoSchema,
      required: [true, "套餐信息不能为空"]
    },
    price: {
      type: Number,
      required: [true, "订单价格不能为空"],
      min: [0, "订单价格不能小于 0"]
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

orderSchema.set("toJSON", {
  transform: function (document, returnedObject) {
    returnedObject.id = String(returnedObject._id);

    if (returnedObject.userId && typeof returnedObject.userId === "object") {
      returnedObject.userId = String(returnedObject.userId._id || returnedObject.userId.id);
    } else if (returnedObject.userId) {
      returnedObject.userId = String(returnedObject.userId);
    }

    if (returnedObject.productId && typeof returnedObject.productId === "object") {
      returnedObject.productId = String(returnedObject.productId._id || returnedObject.productId.id);
    } else if (returnedObject.productId) {
      returnedObject.productId = String(returnedObject.productId);
    }

    delete returnedObject._id;
    return returnedObject;
  }
});

module.exports = {
  Order: mongoose.models.Order || mongoose.model("Order", orderSchema),
  ORDER_STATUS: ORDER_STATUS
};
