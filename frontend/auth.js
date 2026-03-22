(function () {
  const CURRENT_USER_KEY = "kasu_current_user";
  const TOKEN_KEY = "kasu_token";

  const ORDER_STATUS = {
    PENDING: "pending",
    PAID_PENDING_CONFIRM: "paid_pending_confirm",
    COMPLETED: "completed"
  };

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function setCurrentUser(user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearAuthStorage() {
    localStorage.removeItem(CURRENT_USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  function parseJsonSafely(text) {
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return {};
    }
  }

  function buildOrderNo(orderId) {
    const safeId = String(orderId || "");
    return "KS" + safeId.slice(-8).toUpperCase();
  }

  function getStatusLabel(status) {
    if (status === ORDER_STATUS.PENDING) {
      return "待支付";
    }

    if (status === ORDER_STATUS.PAID_PENDING_CONFIRM) {
      return "已付款待确认";
    }

    if (status === ORDER_STATUS.COMPLETED) {
      return "已完成";
    }

    return "未知状态";
  }

  function getStatusClass(status) {
    if (status === ORDER_STATUS.PENDING) {
      return "bg-red-50 text-red-600";
    }

    if (status === ORDER_STATUS.PAID_PENDING_CONFIRM) {
      return "bg-amber-50 text-amber-600";
    }

    return "bg-emerald-50 text-emerald-600";
  }

  function normalizeOrder(order) {
    if (!order) {
      return null;
    }

    const packageInfo = order.packageInfo || {};
    const product = order.product || {};
    const price = order.price !== undefined
      ? order.price
      : (packageInfo.price !== undefined ? packageInfo.price : product.price);
    const flowGB = packageInfo.flowGB !== undefined ? packageInfo.flowGB : product.flowGB;
    const validDays = packageInfo.validDays !== undefined ? packageInfo.validDays : product.validDays;
    const normalizedStatus = order.status || ORDER_STATUS.PENDING;

    return {
      ...order,
      id: String(order.id || order._id || ""),
      orderNo: order.orderNo || buildOrderNo(order.id || order._id),
      planName: order.planName || packageInfo.name || product.name || "--",
      price: Number(price || 0),
      flow: order.flow || (flowGB !== undefined ? String(flowGB) + "GB" : "--"),
      flowGB: Number(flowGB || 0),
      validDays: Number(validDays || 0),
      receiverName: order.receiverName || (order.user ? order.user.nickname : "") || "当前账号",
      receiverPhone: order.receiverPhone || (order.user ? order.user.phone : "") || "--",
      address: order.address || "当前版本未记录收货地址",
      remark: order.remark || "",
      status: normalizedStatus,
      statusLabel: getStatusLabel(normalizedStatus),
      statusClass: getStatusClass(normalizedStatus),
      canConfirmPayment: normalizedStatus === ORDER_STATUS.PENDING,
      canAdminComplete: normalizedStatus === ORDER_STATUS.PAID_PENDING_CONFIRM,
      packageInfo: packageInfo,
      product: product,
      user: order.user || null
    };
  }

  function normalizeOrderList(result) {
    const items = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.orders)
        ? result.orders
        : [];

    return items.map(function (order) {
      return normalizeOrder(order);
    });
  }

  function isAdmin() {
    const currentUser = getCurrentUser();
    return !!currentUser && currentUser.role === "admin";
  }

  async function request(url, options) {
    const token = getToken();
    const requestOptions = options || {};
    const extraHeaders = token
      ? { Authorization: "Bearer " + token }
      : {};

    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        ...requestOptions,
        headers: {
          "Content-Type": "application/json",
          ...extraHeaders,
          ...(requestOptions.headers || {})
        }
      });

      const rawText = await response.text();
      const data = parseJsonSafely(rawText);

      if (!response.ok) {
        if (response.status === 401) {
          clearAuthStorage();
        }

        return {
          success: false,
          message: data.message || "请求失败",
          errors: data.errors || null
        };
      }

      return data;
    } catch (error) {
      return {
        success: false,
        message: "无法连接后端服务，请先启动 Node.js 服务器"
      };
    }
  }

  function storeAuthResult(result) {
    if (result.success && result.user && result.token) {
      setCurrentUser(result.user);
      setToken(result.token);
    }
  }

  async function registerUser(payload) {
    const result = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    storeAuthResult(result);
    return result;
  }

  async function loginUser(payload) {
    const result = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    storeAuthResult(result);
    return result;
  }

  async function getCurrentUserRecord() {
    const result = await request("/api/auth/me", {
      method: "GET"
    });

    if (result.success) {
      setCurrentUser(result.user);
      return result.user;
    }

    return null;
  }

  async function logoutUser() {
    const result = await request("/api/auth/logout", {
      method: "POST"
    });

    clearAuthStorage();
    return result;
  }

  async function getCurrentUserOrders() {
    const result = await request("/orders/my", {
      method: "GET"
    });

    return result.success ? normalizeOrderList(result) : [];
  }

  async function createOrder(payload) {
    const result = await request("/orders", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      data: normalizeOrder(result.data),
      order: normalizeOrder(result.data)
    };
  }

  async function confirmOrderPayment(orderId) {
    const result = await request("/orders/" + orderId + "/confirm-payment", {
      method: "PUT"
    });

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      data: normalizeOrder(result.data),
      order: normalizeOrder(result.data)
    };
  }

  async function updateOrderStatus(orderId, nextStatus) {
    if (nextStatus === ORDER_STATUS.PAID_PENDING_CONFIRM) {
      return confirmOrderPayment(orderId);
    }

    return {
      success: false,
      message: "普通用户不支持直接修改为该状态"
    };
  }

  async function getOrderStats() {
    const orders = await getCurrentUserOrders();

    return {
      total: orders.length,
      pending: orders.filter(function (order) { return order.status === ORDER_STATUS.PENDING; }).length,
      paidPendingConfirm: orders.filter(function (order) { return order.status === ORDER_STATUS.PAID_PENDING_CONFIRM; }).length,
      shipped: orders.filter(function (order) { return order.status === ORDER_STATUS.PAID_PENDING_CONFIRM; }).length,
      completed: orders.filter(function (order) { return order.status === ORDER_STATUS.COMPLETED; }).length
    };
  }

  async function getAdminUsers() {
    return request("/api/admin/users", {
      method: "GET"
    });
  }

  async function getAdminOrders() {
    const result = await request("/admin/orders", {
      method: "GET"
    });

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      orders: normalizeOrderList(result)
    };
  }

  async function getAdminSummary() {
    const result = await getAdminOrders();

    if (!result.success) {
      return result;
    }

    const orders = result.orders || [];
    const totalRevenue = orders.reduce(function (sum, order) {
      return sum + Number(order.price || 0);
    }, 0);

    return {
      success: true,
      summary: {
        totalOrders: orders.length,
        pendingOrders: orders.filter(function (order) { return order.status === ORDER_STATUS.PENDING; }).length,
        paidPendingConfirmOrders: orders.filter(function (order) { return order.status === ORDER_STATUS.PAID_PENDING_CONFIRM; }).length,
        shippedOrders: orders.filter(function (order) { return order.status === ORDER_STATUS.PAID_PENDING_CONFIRM; }).length,
        completedOrders: orders.filter(function (order) { return order.status === ORDER_STATUS.COMPLETED; }).length,
        totalRevenue: totalRevenue
      }
    };
  }

  async function updateAdminOrderStatus(orderId, nextStatus) {
    const result = await request("/admin/orders/" + orderId + "/status", {
      method: "PUT",
      body: JSON.stringify({
        status: nextStatus
      })
    });

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      data: normalizeOrder(result.data),
      order: normalizeOrder(result.data)
    };
  }

  window.KasuAuth = {
    ORDER_STATUS: ORDER_STATUS,
    getCurrentUser: getCurrentUser,
    getCurrentUserRecord: getCurrentUserRecord,
    registerUser: registerUser,
    loginUser: loginUser,
    logoutUser: logoutUser,
    isAdmin: isAdmin,
    getStatusLabel: getStatusLabel,
    getStatusClass: getStatusClass,
    getCurrentUserOrders: getCurrentUserOrders,
    createOrder: createOrder,
    confirmOrderPayment: confirmOrderPayment,
    updateOrderStatus: updateOrderStatus,
    getOrderStats: getOrderStats,
    getAdminSummary: getAdminSummary,
    getAdminUsers: getAdminUsers,
    getAdminOrders: getAdminOrders,
    updateAdminOrderStatus: updateAdminOrderStatus
  };
})();
