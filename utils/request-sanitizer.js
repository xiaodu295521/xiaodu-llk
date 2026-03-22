function sanitizeString(value) {
  return String(value)
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isDangerousKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype" || key.indexOf("$") !== -1 || key.indexOf(".") !== -1;
}

function sanitizeValueInPlace(container, key) {
  const value = container[key];

  if (Array.isArray(value)) {
    value.forEach(function (item, index) {
      if (typeof item === "string") {
        value[index] = sanitizeString(item);
        return;
      }

      if (isPlainObject(item)) {
        sanitizeObjectInPlace(item);
      }
    });
    return;
  }

  if (isPlainObject(value)) {
    sanitizeObjectInPlace(value);
    return;
  }

  if (typeof value === "string") {
    container[key] = sanitizeString(value);
  }
}

function sanitizeObjectInPlace(target) {
  Object.keys(target).forEach(function (key) {
    if (isDangerousKey(key)) {
      delete target[key];
      return;
    }

    sanitizeValueInPlace(target, key);
  });
}

function sanitizeRequestData(req, res, next) {
  if (req.body && isPlainObject(req.body)) {
    sanitizeObjectInPlace(req.body);
  }

  if (req.query && typeof req.query === "object") {
    sanitizeObjectInPlace(req.query);
  }

  if (req.params && typeof req.params === "object") {
    sanitizeObjectInPlace(req.params);
  }

  next();
}

module.exports = {
  sanitizeRequestData,
  sanitizeString
};
