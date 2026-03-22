const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: [true, "手机号不能为空"],
      unique: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, "密码哈希不能为空"]
    },
    nickname: {
      type: String,
      required: [true, "昵称不能为空"],
      trim: true,
      maxlength: [50, "昵称不能超过 50 个字符"]
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

userSchema.index({ phone: 1 }, { unique: true });

userSchema.set("toJSON", {
  transform: function (document, returnedObject) {
    returnedObject.id = String(returnedObject._id);
    delete returnedObject._id;
    delete returnedObject.passwordHash;
    return returnedObject;
  }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
