import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BK_URL,
  timeout: 5000, // 5 giây
});

export default axiosInstance;