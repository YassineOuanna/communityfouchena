import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cf_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.code === "USER_BANNED") {
      localStorage.removeItem("cf_token");
      localStorage.removeItem("cf_user");
      alert(
        `Blacklisted: ${error.response.data.message}\nReason: ${
          error.response.data.reason || "Permanent community ban"
        }`
      );
      window.location.href = "/auth";
    } else if (error.response?.status === 401 && error.response?.data?.code === "TOKEN_REVOKED") {
      localStorage.removeItem("cf_token");
      localStorage.removeItem("cf_user");
      alert("Session invalidated or password was changed. Please log in again.");
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

export default api;
