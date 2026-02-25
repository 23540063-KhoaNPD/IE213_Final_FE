import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BK_URL,
  timeout: 5000, // 5 giây
  withCredentials: false
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Nếu không có response → server chết / CORS / network error
    if (!error.response) {
      window.location.href = "/404";
      return Promise.reject(error);
    }

    // Nếu server trả 5xx
    if (error.response.status >= 500) {
      window.location.href = "/404";
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;