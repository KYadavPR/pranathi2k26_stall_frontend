import { useEffect, useState } from "react";
import axios from "axios";
import API from "../api";
import { saveOrderId } from "../utils/userStorage";
import { useNavigate, useParams, Link } from "react-router-dom";

export default function UserPage({ editMode = false }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const { id: editOrderId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
    if (editMode && editOrderId) {
      fetchOrderToEdit();
    }
  }, [editMode, editOrderId]);

  const fetchProducts = () => {
    axios.get(`${API}/products`).then(res => setProducts(res.data));
  };

  const fetchOrderToEdit = async () => {
    try {
      const res = await axios.get(`${API}/orders/user?ids=["${editOrderId}"]`);
      if (res.data && res.data[0]) {
        setCart(res.data[0].items);
      }
    } catch (err) {
      console.error("Failed to fetch order to edit", err);
    }
  };

  const addToCart = (p) => {
    if (p.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item._id === p._id);
      if (existing) {
        return prev.map(item => item._id === p._id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...p, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item._id !== id));
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item._id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const handleOrderAction = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      let res;
      if (editMode) {
        res = await axios.put(`${API}/orders/${editOrderId}`, { items: cart });
        alert("Order updated successfully!");
        navigate("/orders");
      } else {
        res = await axios.post(`${API}/orders`, { items: cart });
        saveOrderId(res.data._id);
        setLastOrder(res.data);
        setCart([]);
        fetchProducts();
      }
    } catch (err) {
      alert("Action failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const getProductImg = (p) => {
    if (p.image) return p.image;
    const keywords = p.name.toLowerCase().includes('soda') ? 'soda,bottle' :
      p.name.toLowerCase().includes('fry') ? 'fries,potato' :
        p.name.toLowerCase().includes('chip') ? 'chips,snack' :
          p.name.toLowerCase().includes('combo') ? 'food,meal' : p.name.split(' ').join(',');
    return `https://loremflickr.com/400/300/${keywords}`;
  };

  const getStockLabel = (stock) => {
    if (stock <= 0) return { label: "OUT OF STOCK", color: "var(--shastra-red)" };
    if (stock < 25) return { label: `HURRY UP!! ONLY ${stock} LEFT!!`, color: "var(--shastra-red)" };
    if (stock < 50) return { label: "ONLY FEW ITEMS LEFT", color: "var(--shastra-gold-light)" };
    return { label: "AVAILABLE", color: "#28a745" };
  };

  const individuals = products.filter(p => p.type === "individual");
  const combos = products.filter(p => p.type === "combo");

  return (
    <div className="kiosk-container">
      {/* Product Feed */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <header className="kiosk-header">
          <div className="logo">Soda Shastra</div>
          <span className="tagline">✦ Ancient Taste, Modern Twist ✦</span>
          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1rem" }}>
            <span style={{ color: "var(--shastra-gold)", fontSize: "0.8rem", fontWeight: 700 }}>PRANATHI 2K26</span>
            {!editMode && <Link to="/orders" className="btn-primary" style={{ padding: "4px 12px", fontSize: "0.7rem", height: "auto", boxShadow: "none" }}>MY ORDERS</Link>}
          </div>
        </header>

        <div style={{ overflowY: "auto", flex: 1, paddingRight: "10px" }}>
          {/* DIVINE COMBOS */}
          {combos.length > 0 && (
            <>
              <h2 className="section-title">✨ Divine Combo Tickets</h2>
              <div className="combo-grid">
                {combos.map(p => {
                  const stockInfo = getStockLabel(p.stock);
                  return (
                    <div key={p._id} className={`combo-ticket ${p.stock <= 0 ? 'out-of-stock' : ''}`} onClick={() => addToCart(p)}>
                      <div className="combo-left">
                        <div style={{ fontSize: "0.8rem", fontWeight: 900 }}>COMBO</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>₹{p.price}</div>
                        <div style={{ fontSize: "0.6rem", opacity: 0.8 }}>Limited Offer</div>
                      </div>
                      <div className="combo-right">
                        <div className="combo-details">
                          <h3>{p.name.toUpperCase()}</h3>
                          <div style={{ fontSize: "0.8rem", color: "var(--shastra-maroon)", opacity: 0.7, marginBottom: "4px" }}>
                            {p.components.map(c => typeof c === 'object' ? c.name : c).join(" • ")}
                          </div>
                          <div className="product-description" style={{ color: "var(--shastra-maroon)", opacity: 0.6, fontSize: "0.7rem", fontStyle: "italic" }}>
                            {p.description || "Divine bundle of happiness!"}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: stockInfo.color, fontWeight: 700, marginTop: "6px" }}>
                            {stockInfo.label}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "var(--shastra-gold)", fontSize: "1.2rem", fontWeight: 900 }}>+ ADD</div>
                        </div>
                      </div>
                      <div className="ticket-tear"></div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* INDIVIDUAL ITEMS */}
          <h2 className="section-title">🥤 Individual Sips & Bites</h2>
          <div className="product-grid">
            {individuals.map(p => {
              const stockInfo = getStockLabel(p.stock);
              return (
                <div key={p._id} className={`product-card ${p.stock <= 0 ? 'out-of-stock' : ''}`} onClick={() => addToCart(p)}>
                  <img src={getProductImg(p)} className="product-image" alt={p.name} />
                  <div className="product-info">
                    <div>
                      <div className="product-name">{p.name}</div>
                      <div className="product-description">{p.description}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div className="product-price">₹{p.price}</div>
                        <div style={{ fontSize: "0.7rem", color: stockInfo.color, fontWeight: 700 }}>{stockInfo.label}</div>
                      </div>
                      <div style={{ color: "var(--shastra-gold)", fontWeight: 900, fontSize: "0.9rem" }}>+ TAP</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <footer style={{ marginTop: "1rem", borderTop: "1px solid var(--shastra-gold)", paddingTop: "1rem", fontSize: "0.75rem", textAlign: "center", opacity: 0.8 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", color: "var(--shastra-gold-light)" }}>
            <span>Karthik: 7795062638</span>
            <span>Jayanth: 8150971262</span>
            <span>Tejas: 7996996157</span>
          </div>
          <p style={{ marginTop: "5px", color: "var(--shastra-gold)" }}>Good Food • Good Mood • Great Memories</p>
        </footer>
      </div>

      {/* Cart Panel */}
      <div className="cart-panel">
        <h2 style={{ marginBottom: "1rem", color: "var(--shastra-maroon)", borderBottom: "2px dashed var(--shastra-maroon)", paddingBottom: "10px", textAlign: "center" }}>
          {editMode ? "REVISE" : "TOKEN"}
        </h2>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", color: "#666", marginTop: "3rem", fontStyle: "italic" }}>Empty...</div>
          ) : (
            cart.map(item => (
              <div key={item._id} className="cart-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{item.name.toUpperCase()}</div>
                  <div className="qty-controls" style={{ marginTop: "5px" }}>
                    <button className="qty-btn" onClick={() => updateQuantity(item._id, -1)}>−</button>
                    <span style={{ fontWeight: 800 }}>{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQuantity(item._id, 1)}>+</button>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 900 }}>₹{item.price * item.quantity}</div>
                  <button onClick={() => removeFromCart(item._id)} style={{ background: "none", border: "none", color: "var(--shastra-red)", fontSize: "0.7rem", cursor: "pointer", marginTop: "5px" }}>REMOVE</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ borderTop: "2px solid var(--shastra-maroon)", paddingTop: "1rem", marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.5rem", fontWeight: 900, marginBottom: "1rem", fontFamily: 'Cinzel' }}>
            <span>TOTAL</span>
            <span>₹{total}</span>
          </div>
          <button className="btn-primary" style={{ width: "100%" }} onClick={handleOrderAction} disabled={cart.length === 0 || loading}>
            {loading ? "SAVING..." : editMode ? "SAVE CHANGES" : "GET TOKEN"}
          </button>
        </div>
      </div>

      {/* Success Overlay */}
      {lastOrder && (
        <div className="overlay" style={{ cursor: "pointer" }} onClick={() => setLastOrder(null)}>
          <div className="success-card" style={{ cursor: "default" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔱</div>
            <h2 style={{ fontFamily: 'Cinzel', fontSize: "1.5rem", color: "var(--shastra-maroon)" }}>ORDER PLACED!</h2>
            <div className="order-id" style={{ background: "var(--shastra-maroon)", color: "var(--shastra-gold)", padding: "10px", fontSize: "2.5rem", margin: "1rem 0", borderRadius: "8px", fontWeight: 900 }}>
              #{lastOrder.tokenNumber}
            </div>
            <p style={{ fontFamily: 'Almendra', fontSize: "1.2rem", fontWeight: 600 }}>VALUE: ₹{lastOrder.total}</p>
            <button className="btn-primary" onClick={() => setLastOrder(null)} style={{ width: "100%", marginTop: "1.5rem" }}>
              BACK TO MENU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}