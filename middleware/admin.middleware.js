function requireAdmin(req, res, next) {
  if (!req.currentUser || req.currentUser.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "需要管理员权限"
    });
  }

  next();
}

module.exports = {
  requireAdmin
};
