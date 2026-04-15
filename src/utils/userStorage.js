export const saveCart = (cart) => {
    localStorage.setItem("cart", JSON.stringify(cart));
};

export const loadCart = () => {
    const data = localStorage.getItem("cart");
    return data ? JSON.parse(data) : [];
};

export const clearCart = () => {
    localStorage.removeItem("cart");
};

export const saveOrderId = (orderId) => {
    const orders = loadOrderIds();
    if (!orders.includes(orderId)) {
        localStorage.setItem("userOrderIds", JSON.stringify([...orders, orderId]));
    }
};

export const loadOrderIds = () => {
    const data = localStorage.getItem("userOrderIds");
    return data ? JSON.parse(data) : [];
};
