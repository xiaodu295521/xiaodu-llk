function sanitizeString(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    const sanitized = {};

    Object.keys(value).forEach(function (key) {
      sanitized[key] = sanitizeValue(value[key]);
    });

    return sanitized;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  return value;
}

function sanitizeRequestData(req, res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeValue(req.query);
  }

  next();
}

module.exports = {
  sanitizeRequestData,
  sanitizeString
};
