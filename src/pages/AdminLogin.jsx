import { useState } from "react";
import axios from "axios";
import API from "../api";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
    const [data, setData] = useState({ username: "", password: "" });
    const navigate = useNavigate();

    const login = async () => {
        try {
            const res = await axios.post(`${API}/admin/login`, data);
            localStorage.setItem("token", res.data.token);
            navigate("/dashboard");
        } catch {
            alert("Login failed");
        }
    };

    return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--shastra-dark)" }}>
            <div className="success-card" style={{ padding: "4rem", minWidth: "350px", border: "5px double var(--shastra-gold)", boxShadow: "0 0 50px rgba(212, 175, 55, 0.2)" }}>
                <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔐</div>
                <h2 style={{ marginBottom: "2.5rem", color: "var(--shastra-gold)", fontSize: "2rem" }}>ADMIN ACCESS</h2>

                <input
                    placeholder="USERNAME"
                    className="p-input"
                    style={{ marginBottom: "1.5rem", width: "100%", textAlign: "center", textTransform: "uppercase" }}
                    onChange={(e) => setData({ ...data, username: e.target.value })}
                />

                <input
                    type="password"
                    placeholder="PASSWORD"
                    className="p-input"
                    style={{ marginBottom: "2.5rem", width: "100%", textAlign: "center" }}
                    onChange={(e) => setData({ ...data, password: e.target.value })}
                />

                <button className="btn-primary" onClick={login} style={{ width: "100%", fontSize: "1.1rem" }}>ENTER DASHBOARD</button>
            </div>
        </div>
    );
}