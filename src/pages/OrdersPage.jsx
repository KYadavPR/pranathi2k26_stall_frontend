import { useEffect, useState } from "react";
import axios from "axios";
import API from "../api";
import { loadOrderIds } from "../utils/userStorage";
import { useNavigate, Link } from "react-router-dom";

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchOrders = async () => {
            const ids = loadOrderIds();
            if (ids.length === 0) {
                setLoading(false);
                return;
            }
            try {
                const res = await axios.get(`${API}/orders/user`, { params: { ids: JSON.stringify(ids) } });
                setOrders(res.data);
            } catch (err) {
                console.error("Failed to fetch orders", err);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, []);

    return (
        <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto", background: "var(--shastra-dark)", minHeight: "100vh" }}>
            <header className="kiosk-header" style={{ borderBottom: "1px dashed var(--shastra-gold)", paddingBottom: "1rem", marginBottom: "2rem" }}>
                <Link to="/" className="logo" style={{ textDecoration: "none", fontSize: "2rem" }}>Soda Shastra</Link>
                <div style={{ marginTop: "10px" }}>
                    <Link to="/" className="btn-primary" style={{ textDecoration: "none", padding: "6px 15px", fontSize: "0.8rem" }}>BACK TO KIOSK</Link>
                </div>
            </header>

            <h2 style={{ marginBottom: "2rem", fontWeight: 800, color: "var(--shastra-gold)", textAlign: "center", textDecoration: "underline" }}>DIVINE ORDER HISTORY</h2>

            {loading ? (
                <p style={{ color: "var(--shastra-gold-light)", textAlign: "center" }}>Summoning your order details...</p>
            ) : orders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "4rem", border: "2px dashed var(--shastra-gold)", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
                    <p style={{ color: "var(--shastra-gold-light)", fontFamily: 'Almendra', fontSize: "1.2rem" }}>No sips found in your history.</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: "1.5rem", justifyContent: "center" }}>
                    {orders.map(order => (
                        <div key={order._id} className="cart-panel" style={{ minWidth: "300px", flex: "1 1 300px", height: "auto", borderLeft: "5px solid var(--shastra-gold)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", borderBottom: "1px dashed var(--shastra-maroon)", paddingBottom: "0.5rem" }}>
                                <div>
                                    <h3 style={{ fontWeight: 800, color: "var(--shastra-maroon)", fontSize: "1rem" }}>TOKEN #{order._id.slice(-5).toUpperCase()}</h3>
                                    <p style={{ color: "var(--shastra-dark)", fontSize: "0.75rem", opacity: 0.7 }}>{new Date(order.createdAt).toLocaleTimeString()}</p>
                                </div>
                                <div className={`badge ${order.status === 'pending' ? 'badge-low' : 'badge-ok'}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                                    {order.status.toUpperCase()}
                                </div>
                            </div>

                            <div style={{ marginBottom: "1rem" }}>
                                {order.items.map((item, idx) => (
                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", color: "var(--shastra-dark)", marginBottom: "0.25rem", fontWeight: 500 }}>
                                        <span>{item.name} x{item.quantity}</span>
                                        <span style={{ fontWeight: 700 }}>₹{item.price * item.quantity}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.1)", paddingTop: "1rem" }}>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--shastra-maroon)" }}>₹{order.total}</div>
                                {order.status === "pending" && (
                                    <button
                                        onClick={() => navigate(`/edit-order/${order._id}`)}
                                        className="btn-primary"
                                        style={{ background: "var(--shastra-maroon)", color: "white", padding: "4px 12px", fontSize: "0.7rem", boxSizing: "border-box" }}
                                    >
                                        REVISE
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
