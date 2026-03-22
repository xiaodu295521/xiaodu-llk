const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "商品名称不能为空"],
      trim: true,
      minlength: [2, "商品名称至少 2 个字符"],
      maxlength: [100, "商品名称不能超过 100 个字符"]
    },
    price: {
      type: Number,
      required: [true, "商品价格不能为空"],
      min: [0, "商品价格不能小于 0"]
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
    timestamps: true,
    versionKey: false
  }
);

productSchema.index({ name: 1 });
productSchema.index({ isRecommended: 1, createdAt: -1 });

productSchema.set("toJSON", {
  transform: function (document, returnedObject) {
    returnedObject.id = String(returnedObject._id);
    delete returnedObject._id;
    return returnedObject;
  }
});

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);
