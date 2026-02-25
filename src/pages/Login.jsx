import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../services/axiosInstance";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [Email, setEmail] = useState("");
  const [PW, setPW] = useState("");
  const [checkingServer, setCheckingServer] = useState(true);

  // ✅ CHECK SERVER ALIVE
  useEffect(() => {
    const checkServer = async () => {
      try {
        await axios.get("/health");
        setCheckingServer(false);
      } catch (error) {
        console.error("Server không phản hồi:", error);
        navigate("/404");
      }
    };

    checkServer();
  }, [navigate]);

  if (checkingServer) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        Checking server...
      </div>
    );
  }

  const handleSubmit = async () => {
    try {
      if (isLogin) {
        const res = await axios.post("/api/users/login", {
          Email,
          PW
        });

        const data = res.data;

        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("userId", data.userId);

        navigate("/home");
      } else {
        await axios.post("/api/users/signup", {
          name,
          email: Email,
          password: PW
        });

        alert("Account created. Please login.");
        setIsLogin(true);
      }
    } catch (error) {
      console.error(error);
      alert(isLogin ? "Login failed" : "Signup failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-title">
          {isLogin ? "Login" : "Create Account"}
        </h2>

        {!isLogin && (
          <input
            type="text"
            placeholder="Username"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={Email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={PW}
          onChange={(e) => setPW(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        <button className="auth-button" onClick={handleSubmit}>
          {isLogin ? "Login" : "Sign Up"}
        </button>

        {isLogin && (
          <div
            className="auth-link"
            onClick={() => navigate("/forgot-password")}
          >
            Forgot password?
          </div>
        )}

        <div
          className="auth-link"
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin
            ? "Don't have an account? Sign up"
            : "Already have an account? Login"}
        </div>
      </div>
    </div>
  );
}