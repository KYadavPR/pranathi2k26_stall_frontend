import { useEffect, useState } from "react";
import axios from "axios";
import API from "../api";
import { useNavigate } from "react-router-dom";
import React from "react";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [orders, setOrders] = useState([]);
    const [tab, setTab] = useState("analytics");
    const [editingProduct, setEditingProduct] = useState(null);
    const [printingOrder, setPrintingOrder] = useState(null);

    const [itemForm, setItemForm] = useState({ name: "", price: "", cost: "", stock: "", image: "", description: "" });
    const [comboForm, setComboForm] = useState({ name: "", price: "", cost: "", stock: "", components: [], image: "", description: "" });
    const [newAdmin, setNewAdmin] = useState({ username: "", password: "" });
    const [bookingCart, setBookingCart] = useState([]);
    const [bookingLoading, setBookingLoading] = useState(false);

    const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) navigate("/admin");
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const prodRes = await axios.get(`${API}/products`);
            const orderRes = await axios.get(`${API}/orders`, getAuthHeader());
            setProducts(prodRes.data);
            setOrders(orderRes.data);
        } catch (err) {
            if (err.response?.status === 401) navigate("/admin");
        }
    };

    const addAdmin = async () => {
        if (!newAdmin.username || !newAdmin.password) return alert("Fill all fields");
        await axios.post(`${API}/admin/register`, newAdmin, getAuthHeader());
        setNewAdmin({ username: "", password: "" });
        alert("New admin added!");
    };

    const handleItemSubmit = async () => {
        if (!itemForm.name || !itemForm.price) return alert("Fill Name and Price");
        try {
            if (editingProduct) await axios.put(`${API}/products/${editingProduct._id}`, itemForm, getAuthHeader());
            else await axios.post(`${API}/products`, { ...itemForm, type: "individual" }, getAuthHeader());
            cancelEdit();
            fetchData();
        } catch { alert("Action failed"); }
    };

    const handleComboSubmit = async () => {
        if (!comboForm.name || !comboForm.price) return alert("Fill Name and Price");
        try {
            // Automatic Cost Calculation
            const compCosts = comboForm.components.reduce((sum, cId) => {
                const comp = products.find(p => p._id === (typeof cId === 'object' ? cId._id : cId));
                return sum + (Number(comp?.cost) || 0);
            }, 0);
            const submissionData = { ...comboForm, cost: compCosts, type: "combo" };

            if (editingProduct) await axios.put(`${API}/products/${editingProduct._id}`, submissionData, getAuthHeader());
            else await axios.post(`${API}/products`, submissionData, getAuthHeader());
            cancelEdit();
            fetchData();
        } catch { alert("Action failed"); }
    };

    const cancelEdit = () => {
        setEditingProduct(null);
        setItemForm({ name: "", price: "", cost: "", stock: "", image: "", description: "" });
        setComboForm({ name: "", price: "", cost: "", stock: "", components: [], image: "", description: "" });
    };

    const startEdit = (p) => {
        setEditingProduct(p);
        if (p.type === "individual") setItemForm({ ...p });
        else setComboForm({ ...p, components: p.components.map(c => typeof c === 'object' ? c._id : c) });
        setTab("inventory");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteProduct = async (id) => {
        if (window.confirm("Delete product?")) {
            await axios.delete(`${API}/products/${id}`, getAuthHeader());
            fetchData();
        }
    };

    const markPaid = async (id) => {
        await axios.put(`${API}/orders/${id}`, { status: "completed" }, getAuthHeader());
        fetchData();
    };

    const printToPhone = async (order) => {
        const ESC = '\x1B';
        const GS = '\x1D';
        const L = '--------------------------------\n';

        let t = '';
        t += ESC + '@'; // init
        t += ESC + 'a' + '\x01'; // center
        t += ESC + 'E' + '\x01'; // bold on
        t += 'SODA SHASTRA\n';
        t += ESC + 'E' + '\x00'; // bold off
        t += 'Ancient Taste, Modern Twist\n';
        t += 'Pranathi 2k26 Edition\n';
        t += ESC + 'a' + '\x00'; // left
        t += L;
        t += `Bill No: ${order.tokenNumber}  ${new Date(order.createdAt).toLocaleTimeString()}\n`;
        t += L;

        order.detailedItems.forEach(i => {
            const line = `${i.quantity}x ${i.name}`;
            const price = `${(i.price * i.quantity).toFixed(0)}`;
            // Manual padding logic for 32-column thermal printers
            t += line.padEnd(24).slice(0, 24) + price.padStart(8) + '\n';
        });

        t += L;
        t += 'TOTAL'.padEnd(24) + `${order.total.toFixed(2)}`.padStart(8) + '\n';
        t += L;
        t += ESC + 'a' + '\x01'; // center
        if (order.totalSaved) t += `You Saved: Rs.${order.totalSaved.toFixed(0)}\n`;
        t += 'Thank you! Visit again\n';
        t += ESC + 'a' + '\x00';
        t += '\n\n\n';
        t += GS + 'V' + '\x41' + '\x03'; // cut

        try {
            await fetch('http://192.168.1.6:8080/print', {
                method: 'POST',
                body: t,
                headers: { 'Content-Type': 'text/plain' }
            });
            console.log("Sent to printer!");
        } catch (err) {
            console.error("Failed to print to phone", err);
        }
    };

    const handlePrint = (order) => {
        const detailedItems = order.items.map(it => {
            const prod = products.find(p => p._id === it._id);
            if (prod && prod.type === "combo") {
                const comboComponents = prod.components.map(cId => {
                    const comp = products.find(p => p._id === (typeof cId === 'object' ? cId._id : cId));
                    return comp || { name: "Unknown", price: 0 };
                });
                const subtotal = comboComponents.reduce((s, c) => s + c.price, 0);
                const discount = subtotal - prod.price;
                return { ...it, isCombo: true, components: comboComponents, subtotal, discount };
            }
            return { ...it, isCombo: false };
        });

        const hasCombo = detailedItems.some(it => it.isCombo);
        const totalSubtotal = detailedItems.reduce((s, it) => s + (it.isCombo ? it.subtotal : (it.price * it.quantity)), 0);
        const totalDiscount = detailedItems.reduce((s, it) => s + (it.isCombo ? it.discount : 0), 0);
        const totalSaved = totalDiscount;

        const printData = { ...order, detailedItems, hasCombo, totalSubtotal, totalDiscount, totalSaved };

        setPrintingOrder(printData);
        printToPhone(printData); // Trigger RawBT printing

        setTimeout(() => {
            window.print();
            setPrintingOrder(null);
        }, 300);
    };

    const downloadOrdersCSV = () => {
        const headers = ["Token", "Date", "Time", "Amount(₹)", "Profit(₹)", "Status", "Items"];
        const rows = orders.map(o => [
            o.tokenNumber,
            new Date(o.createdAt).toLocaleDateString(),
            new Date(o.createdAt).toLocaleTimeString(),
            o.total,
            o.profit || 0,
            o.status.toUpperCase(),
            `"${o.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}"`
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `SodaShastra_Orders_${new Date().toLocaleDateString()}.csv`);
        link.click();
    };

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const totalProfit = orders.reduce((sum, o) => sum + (o.profit || 0), 0);
    const pendingOrders = orders.filter(o => o.status === "pending");
    const paidOrders = orders.filter(o => o.status === "completed").slice(0, 10);

    const addToBookingCart = (p) => {
        if (p.stock <= 0) return;
        setBookingCart(prev => {
            const existing = prev.find(item => item._id === p._id);
            if (existing) return prev.map(item => item._id === p._id ? { ...item, quantity: item.quantity + 1 } : item);
            return [...prev, { ...p, quantity: 1 }];
        });
    };

    const updateBookingQuantity = (id, delta) => {
        setBookingCart(prev => prev.map(item => item._id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
    };

    const removeFromBookingCart = (id) => {
        setBookingCart(prev => prev.filter(item => item._id !== id));
    };

    const handleBookingSubmit = async () => {
        if (bookingCart.length === 0) return;
        setBookingLoading(true);
        try {
            const res = await axios.post(`${API}/orders`, { items: bookingCart, status: "completed" }, getAuthHeader());
            setBookingCart([]);
            fetchData();
            handlePrint(res.data);
            alert(`Booking successful! Token #${res.data.tokenNumber}`);
        } catch (err) {
            alert("Booking failed. Please try again.");
        } finally {
            setBookingLoading(false);
        }
    };

    const bookingTotal = bookingCart.reduce((sum, it) => sum + (it.price * it.quantity), 0);

    return (
        <div className="container" style={{ minHeight: "100vh" }}>

            {/* CONDENSED PRINT SECTION (3-INCH WIDTH) */}
            {printingOrder && (
                <div id="print-section" style={{ textAlign: "left", width: "76mm", padding: "5px", margin: "0", color: "#000", background: "#fff", fontFamily: "'Courier New', Courier, monospace" }}>
                    <div style={{ textAlign: "center", marginBottom: "10px" }}>
                        <h1 style={{ margin: "0", fontSize: "1.6rem", fontWeight: "900" }}>SODA SHASTRA</h1>
                        <p style={{ margin: "2px 0", fontSize: "0.85rem", fontWeight: "bold", borderY: "1px dashed #000", padding: "2px 0" }}>Ancient Taste, Modern Twist</p>
                        <p style={{ margin: "0", fontSize: "0.85rem" }}>Pranathi 2k26 Edition</p>
                    </div>

                    <div style={{ marginBottom: "8px", fontSize: "0.8rem", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #000" }}>
                        <span>Bill: {printingOrder.tokenNumber}</span>
                        <span style={{ fontWeight: "bold" }}>{new Date(printingOrder.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>

                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "8px", fontSize: "0.95rem" }}>
                        <thead style={{ borderBottom: "1px solid #000" }}>
                            <tr>
                                <th style={{ textAlign: "left" }}>ITEM</th>
                                <th style={{ textAlign: "center" }}>QTY</th>
                                <th style={{ textAlign: "right" }}>VAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printingOrder.detailedItems.map((it, idx) => (
                                <React.Fragment key={idx}>
                                    <tr style={{ fontWeight: "bold" }}>
                                        <td style={{ padding: "4px 0 0" }}>{it.name.toUpperCase()}</td>
                                        <td style={{ textAlign: "center" }}>{it.quantity}</td>
                                        <td style={{ textAlign: "right" }}>{it.price.toFixed(0)}</td>
                                    </tr>
                                    {it.isCombo && it.components.map((comp, ci) => (
                                        <tr key={ci} style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                                            <td style={{ paddingLeft: "8px" }}>⤷ {comp.name}</td>
                                            <td style={{ textAlign: "center" }}>1</td>
                                            <td style={{ textAlign: "right" }}>{comp.price.toFixed(0)}</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>

                    {printingOrder.hasCombo && (
                        <div style={{ borderTop: "1px dashed #000", marginBottom: "8px", fontSize: "0.85rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span>MRP TOTAL: Rs.{printingOrder.totalSubtotal.toFixed(0)}</span>
                                <span style={{ fontStyle: "italic" }}>OFF: -Rs.{printingOrder.totalDiscount.toFixed(0)}</span>
                            </div>
                        </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #000", borderBottom: "2px solid #000", padding: "5px 0", marginBottom: "8px", fontWeight: "900", fontSize: "1.3rem" }}>
                        <span>NET PAY</span>
                        <span>Rs.{printingOrder.total.toFixed(0)}</span>
                    </div>

                    {printingOrder.hasCombo && (
                        <div style={{ textAlign: "center", border: "1px solid #000", padding: "4px", marginBottom: "8px" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: "bold" }}>SAVED: Rs.{printingOrder.totalDiscount.toFixed(0)}</span>
                        </div>
                    )}

                    <div style={{ textAlign: "center", fontSize: "0.85rem" }}>
                        <p style={{ margin: "2px 0", fontWeight: "bold" }}>THANK YOU! VISIT AGAIN</p>
                        <p style={{ margin: "0" }}>Stay Updated: @sodashastra</p>
                    </div>
                </div>
            )}

            <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderRadius: "10px", background: "var(--shastra-maroon)", border: "1px solid var(--shastra-gold)", marginBottom: "2rem", gap: "1rem" }}>
                <h1 style={{ color: "var(--shastra-gold)", margin: 0, fontSize: "min(2rem, 6vw)" }}>ADMIN PANEL</h1>
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => navigate("/")} className="btn-secondary" style={{ padding: "5px 15px", fontSize: "0.8rem" }}>KIOSK</button>
                    <button onClick={() => { localStorage.removeItem("token"); navigate("/admin"); }} className="btn-primary" style={{ background: "var(--shastra-red)", padding: "5px 15px", fontSize: "0.8rem", boxShadow: "none" }}>LOGOUT</button>
                </div>
            </header>

            {/* QUICK STATS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                <div className="glass-stats" onClick={() => setTab("analytics")}>
                    <small>Total Sales</small>
                    <h3>₹{totalSales}</h3>
                </div>
                <div className="glass-stats">
                    <small>Total Profit</small>
                    <h3 style={{ color: "#28a745" }}>₹{totalProfit}</h3>
                </div>
                <div className="glass-stats" onClick={() => setTab("analytics")}>
                    <small>Pending</small>
                    <h3 style={{ color: "var(--shastra-red)" }}>{pendingOrders.length}</h3>
                </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "2rem", overflowX: "auto", paddingBottom: "5px" }}>
                <button onClick={() => setTab("analytics")} className={`tab-pill ${tab === 'analytics' ? 'active' : ''}`}>ORDERS</button>
                <button onClick={() => setTab("booking")} className={`tab-pill ${tab === 'booking' ? 'active' : ''}`}>BOOKING</button>
                <button onClick={() => setTab("inventory")} className={`tab-pill ${tab === 'inventory' ? 'active' : ''}`}>INVENTORY</button>
                <button onClick={() => setTab("team")} className={`tab-pill ${tab === 'team' ? 'active' : ''}`}>TEAM</button>
            </div>

            {tab === "booking" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "2rem" }}>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "1.5rem", borderRadius: "15px", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <h4 className="premium-header" style={{ marginTop: 0 }}>Select Products</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "15px" }}>
                            {products.map(p => (
                                <div key={p._id} className={`inventory-card ${p.stock <= 0 ? 'out-of-stock' : ''}`} style={{ flexDirection: "column", padding: "10px", cursor: p.stock > 0 ? "pointer" : "default" }} onClick={() => p.stock > 0 && addToBookingCart(p)}>
                                    <img src={p.image || "https://via.placeholder.com/80?text=Food"} style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "8px" }} alt={p.name} />
                                    <div style={{ textAlign: "center", marginTop: "10px" }}>
                                        <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--shastra-gold)" }}>{p.name.toUpperCase()}</div>
                                        <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>₹{p.price}</div>
                                        <div style={{ fontSize: "0.7rem", color: p.stock < 10 ? 'var(--shastra-red)' : '#888' }}>Stock: {p.stock}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="form-box" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", height: "fit-content", position: "sticky", top: "2rem" }}>
                        <h4 className="premium-header" style={{ marginTop: 0, textAlign: "center", borderBottom: "1px dashed var(--shastra-gold)", paddingBottom: "10px" }}>CART</h4>
                        <div style={{ flex: 1, maxHeight: "400px", overflowY: "auto", marginBottom: "1.5rem" }}>
                            {bookingCart.length === 0 ? <div style={{ textAlign: "center", opacity: 0.5, marginTop: "2rem" }}>Cart is empty</div> : (
                                bookingCart.map(it => (
                                    <div key={it._id} style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px" }}>
                                        <div>
                                            <div style={{ fontWeight: 800, fontSize: "0.85rem" }}>{it.name.toUpperCase()}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "5px" }}>
                                                <button onClick={(e) => { e.stopPropagation(); updateBookingQuantity(it._id, -1); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer" }}>-</button>
                                                <span style={{ fontWeight: 900 }}>{it.quantity}</span>
                                                <button onClick={(e) => { e.stopPropagation(); updateBookingQuantity(it._id, 1); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer" }}>+</button>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontWeight: 900 }}>₹{it.price * it.quantity}</div>
                                            <button onClick={(e) => { e.stopPropagation(); removeFromBookingCart(it._id); }} style={{ background: "none", border: "none", color: "var(--shastra-red)", fontSize: "0.7rem", cursor: "pointer", marginTop: "5px" }}>REMOVE</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div style={{ borderTop: "2px solid var(--shastra-gold)", paddingTop: "1rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.3rem", fontWeight: 900, marginBottom: "1rem" }}>
                                <span>TOTAL</span>
                                <span>₹{bookingTotal}</span>
                            </div>
                            <button className="btn-primary" style={{ width: "100%", padding: "12px", fontSize: "1rem" }} onClick={handleBookingSubmit} disabled={bookingCart.length === 0 || bookingLoading}>
                                {bookingLoading ? "PROCESS..." : "GENERATE BILL"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {tab === "analytics" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
                    <div>
                        <h4 className="premium-header">Pending Fulfillment</h4>
                        <div style={{ display: "grid", gap: "10px" }}>
                            {pendingOrders.map(o => (
                                <div key={o._id} className="item-card-lite">
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                        <span className="token-tag">#{o.tokenNumber}</span>
                                        <button onClick={() => { markPaid(o._id); handlePrint(o); }} className="btn-action">PAID</button>
                                    </div>
                                    <div style={{ marginTop: "10px" }}>
                                        {o.items.map((it, i) => <div key={i} style={{ fontSize: "0.8rem" }}>{it.quantity}x {it.name}</div>)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                            <h4 className="premium-header" style={{ margin: 0 }}>Paid Orders</h4>
                            <button onClick={downloadOrdersCSV} className="btn-icon" style={{ background: "var(--shastra-gold)", color: "black", fontWeight: 900 }}>📥 EXPORT EXCEL</button>
                        </div>
                        <div style={{ display: "grid", gap: "10px" }}>
                            {paidOrders.map(o => (
                                <div key={o._id} className="history-card">
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                            <div className="token-circle">#{o.tokenNumber}</div>
                                            <div>
                                                <div style={{ fontWeight: 800 }}>₹{o.total}</div>
                                                <div style={{ fontSize: "0.6rem", opacity: 0.5 }}>{new Date(o.createdAt).toLocaleTimeString()}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => handlePrint(o)} className="btn-icon">PRINT 🖨️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {tab === "inventory" && (
                <div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                        <div className="form-box">
                            <h5>{editingProduct && itemForm.name ? 'Edit Item' : 'New Item'}</h5>
                            <input placeholder="Name" className="p-input" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
                            <div style={{ display: "flex", gap: "10px" }}>
                                <input placeholder="Price" className="p-input" value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} />
                                <input placeholder="Cost" className="p-input" value={itemForm.cost} onChange={e => setItemForm({ ...itemForm, cost: e.target.value })} />
                                <input placeholder="Stock" className="p-input" value={itemForm.stock} onChange={e => setItemForm({ ...itemForm, stock: e.target.value })} />
                            </div>
                            <input placeholder="Image URL" className="p-input" value={itemForm.image} onChange={e => setItemForm({ ...itemForm, image: e.target.value })} />
                            <textarea placeholder="Description" className="p-input" style={{ height: "60px" }} value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })}></textarea>
                            <button onClick={handleItemSubmit} className="btn-primary" style={{ width: "100%" }}>SAVE ITEM</button>
                        </div>

                        <div className="form-box">
                            <h5>{editingProduct && comboForm.name ? 'Edit Combo' : 'New Combo'}</h5>
                            <input placeholder="Combo Name" className="p-input" value={comboForm.name} onChange={e => setComboForm({ ...comboForm, name: e.target.value })} />
                            <div style={{ display: "flex", gap: "10px" }}>
                                <input placeholder="Price" className="p-input" value={comboForm.price} onChange={e => setComboForm({ ...comboForm, price: e.target.value })} />
                                <input placeholder="Manual Stock" className="p-input" value={comboForm.stock} onChange={e => setComboForm({ ...comboForm, stock: e.target.value })} />
                            </div>
                            <input placeholder="Image URL" className="p-input" value={comboForm.image} onChange={e => setComboForm({ ...comboForm, image: e.target.value })} />
                            <textarea placeholder="Description" className="p-input" style={{ height: "60px" }} value={comboForm.description} onChange={e => setComboForm({ ...comboForm, description: e.target.value })}></textarea>

                            <label style={{ fontSize: "0.8rem", color: "var(--shastra-gold)", display: "block", marginBottom: "10px" }}>BUILD BUNDLE:</label>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                                <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px", borderRadius: "10px", maxHeight: "150px", overflowY: "auto" }}>
                                    <div style={{ fontSize: "0.7rem", color: "#888", marginBottom: "5px" }}>AVAILABLE ITEMS:</div>
                                    {products.filter(p => p.type === "individual").map(p => (
                                        <div key={p._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem", marginBottom: "5px" }}>
                                            <span>{p.name}</span>
                                            <button onClick={() => setComboForm(prev => ({ ...prev, components: [...prev.components, p._id] }))} style={{ background: "var(--shastra-gold)", border: "none", borderRadius: "4px", padding: "2px 6px", cursor: "pointer", fontWeight: 900 }}>+</button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ background: "rgba(212,175,55,0.05)", padding: "10px", borderRadius: "10px", maxHeight: "150px", overflowY: "auto" }}>
                                    <div style={{ fontSize: "0.7rem", color: "var(--shastra-gold)", marginBottom: "5px" }}>CURRENT BUNDLE:</div>
                                    {comboForm.components.length === 0 ? <div style={{ fontSize: "0.7rem", opacity: 0.5 }}>None</div> :
                                        comboForm.components.map((cId, idx) => {
                                            const pId = typeof cId === 'object' ? cId._id : cId;
                                            const p = products.find(prod => prod._id === pId);
                                            return (
                                                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.80rem", marginBottom: "5px" }}>
                                                    <span>{p?.name || "..."}</span>
                                                    <button onClick={() => setComboForm(prev => {
                                                        const newComps = [...prev.components];
                                                        newComps.splice(idx, 1);
                                                        return { ...prev, components: newComps };
                                                    })} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "none", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}>×</button>
                                                </div>
                                            );
                                        })
                                    }
                                </div>
                            </div>
                            <div style={{ background: "rgba(45,11,11,0.5)", padding: "10px", borderRadius: "8px", marginBottom: "15px", textAlign: "center", border: "1px dashed var(--shastra-gold)" }}>
                                <div style={{ fontSize: "0.7rem", color: "var(--shastra-gold-light)" }}>AUTO-CALCULATED COST</div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 900 }}>₹{
                                    comboForm.components.reduce((sum, cId) => {
                                        const pId = typeof cId === 'object' ? cId._id : cId;
                                        const p = products.find(prod => prod._id === pId);
                                        return sum + (Number(p?.cost) || 0);
                                    }, 0)
                                }</div>
                            </div>
                            <button onClick={handleComboSubmit} className="btn-primary" style={{ width: "100%" }}>SAVE COMBO</button>
                        </div>
                    </div>

                    {editingProduct && <button onClick={cancelEdit} className="btn-secondary" style={{ marginBottom: "1rem" }}>CANCEL EDIT</button>}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "15px" }}>
                        {products.map(p => (
                            <div key={p._id} className="inventory-card">
                                <img src={p.image || "https://via.placeholder.com/80?text=Food"} className="inv-img" alt={p.name} />
                                <div className="inv-info">
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--shastra-gold)" }}>{p.name.toUpperCase()}</div>
                                        <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "5px" }}>{p.type.toUpperCase()}</div>
                                        <div style={{ display: "flex", gap: "10px", fontSize: "0.85rem" }}>
                                            <span>Price: <b style={{ color: "#fff" }}>₹{p.price}</b></span>
                                            <span>Cost: <b style={{ color: "#ff8888" }}>₹{p.cost || 0}</b></span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                                        <span style={{ fontSize: "0.9rem", fontWeight: 700, color: p.stock < 10 ? 'var(--shastra-red)' : '#fff' }}>{p.stock} units left</span>
                                        <div style={{ display: "flex" }}>
                                            <button onClick={() => startEdit(p)} className="edit-btn">✏️</button>
                                            <button onClick={() => deleteProduct(p._id)} className="del-btn">🗑️</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {tab === "team" && (
                <div style={{ maxWidth: "400px", margin: "0 auto" }} className="form-box">
                    <h5>New Admin</h5>
                    <input placeholder="Username" className="p-input" value={newAdmin.username} onChange={e => setNewAdmin({ ...newAdmin, username: e.target.value })} />
                    <input placeholder="Password" type="password" className="p-input" value={newAdmin.password} onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} />
                    <button onClick={addAdmin} className="btn-primary" style={{ width: "100%" }}>ADD TEAM MEMBER</button>
                </div>
            )}

            <style>{`
                .glass-stats { 
                    background: rgba(45, 11, 11, 0.6); 
                    padding: 2rem; 
                    border-radius: 15px; 
                    border: 1px solid rgba(212, 175, 55, 0.3); 
                    cursor: pointer; 
                    text-align: center; 
                    backdrop-filter: blur(12px);
                    transition: all 0.3s ease;
                }
                .glass-stats:hover {
                    background: rgba(212, 175, 55, 0.1);
                    transform: translateY(-5px);
                    border-color: var(--shastra-gold);
                }
                .tab-pill { background: transparent; color: white; border: 1px solid var(--shastra-gold); padding: 8px 30px; border-radius: 30px; cursor: pointer; white-space: nowrap; font-family: 'Cinzel'; font-weight: 700; transition: all 0.3s; }
                .tab-pill.active { background: var(--shastra-gold); color: black; box-shadow: 0 0 20px rgba(212,175,55,0.3); }
                
                .item-card-lite { background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; border-left: 5px solid var(--shastra-red); border: 1px solid rgba(255,255,255,0.05); }
                
                .history-card { 
                    background: linear-gradient(90deg, #1e0707, #2d0b0b); 
                    padding: 15px 25px; 
                    border-radius: 18px; 
                    border: 1px solid rgba(212, 175, 55, 0.1);
                    transition: all 0.3s;
                }
                .history-card:hover { border-color: var(--shastra-gold); background: rgba(212, 175, 55, 0.05); }

                .token-circle {
                    width: 50px; height: 50px;
                    background: var(--shastra-gold);
                    color: black;
                    border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-weight: 900;
                    font-size: 1rem;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                }
                .form-box { background: rgba(30, 7, 7, 0.8); padding: 2rem; border-radius: 15px; border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(5px); }
                .p-input { width: 100%; margin-bottom: 15px; background: #000; color: #fff; border: 1px solid #333; padding: 12px; border-radius: 10px; font-size: 1rem; }
                .p-input:focus { border-color: var(--shastra-gold); outline: none; box-shadow: 0 0 10px rgba(212, 175, 55, 0.2); }
                
                .inventory-card { 
                    display: flex; gap: 15px; background: rgba(30, 7, 7, 0.6); 
                    padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);
                    transition: all 0.3s;
                }
                .inventory-card:hover { border-color: var(--shastra-gold); background: rgba(212, 175, 55, 0.05); }
                
                .inv-img { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2); }
                .inv-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
                
                .token-tag { background: var(--shastra-red); color: white; padding: 4px 12px; border-radius: 6px; font-weight: 900; font-size: 0.9rem; }
                .btn-action { background: var(--shastra-gold); border: none; padding: 5px 15px; border-radius: 6px; cursor: pointer; font-weight: 800; font-size: 0.9rem; }
                .btn-icon { background: rgba(255, 255, 255, 0.1); color: white; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; transition: all 0.3s; }
                .btn-icon:hover { background: var(--shastra-gold); color: black; }
                
                .edit-btn { background: var(--shastra-gold); border: none; width: 40px; height: 40px; border-radius: 8px; margin-right: 8px; cursor: pointer; font-size: 1rem; font-weight: 900; }
                .del-btn { background: var(--shastra-red); border: none; color: white; width: 40px; height: 40px; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 900; }
                
                @media (min-width: 1200px) {
                  .glass-stats h3 { font-size: 2.5rem; }
                  .glass-stats small { font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; }
                  .p-input { padding: 15px; font-size: 1.1rem; }
                  .premium-header { font-size: 1.5rem; margin-bottom: 1.5rem; }
                  .inventory-card { padding: 20px; }
                }

                @media (max-width: 480px) {
                  .container { padding: 0.5rem; }
                  .header h1 { font-size: 1.2rem; }
                  .glass-stats { padding: 1rem; }
                  .inventory-card { flex-direction: column; align-items: center; text-align: center; }
                  .inv-img { width: 100%; height: 120px; }
                }
                .out-of-stock { opacity: 0.5; filter: grayscale(1); pointer-events: none; position: relative; }
                .out-of-stock::after { content: "OUT OF STOCK"; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); background: var(--shastra-red); color: white; padding: 5px 10px; font-weight: 900; border-radius: 4px; font-size: 0.8rem; z-index: 2; }
            `}</style>
        </div>
    );
}