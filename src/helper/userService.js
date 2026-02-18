import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";


class UserService {

    async login(query) {
        try {
            const response = await axios.post(`${API_URL}/api/v1/user/login`, query, {
                headers: {
                    "Content-Type": "application/json"
                }
            });

            // console.log("FULL RESPONSE:", response);

            return response.data;
        }
        catch (error) {
            console.error("Login error:", error.response?.data || error.message);
            throw error;
        }
    }
}

export default new UserService();