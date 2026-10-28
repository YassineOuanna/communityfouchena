import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("cf_token"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("cf_user");
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        logout();
      }
    }
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { username, password });
      const { token: t, user: u } = res.data;
      localStorage.setItem("cf_token", t);
      localStorage.setItem("cf_user", JSON.stringify(u));
      setToken(t);
      setUser(u);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || (err.message === "Network Error" ? "Cannot reach server. Please run start-server.bat first!" : err.message) || "Login failed";
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, password, email) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { username, password, email: email || undefined });
      const { token: t, user: u } = res.data;
      localStorage.setItem("cf_token", t);
      localStorage.setItem("cf_user", JSON.stringify(u));
      setToken(t);
      setUser(u);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || (err.message === "Network Error" ? "Cannot reach server. Please run start-server.bat first!" : err.message) || "Registration failed";
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("cf_token");
    localStorage.removeItem("cf_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
