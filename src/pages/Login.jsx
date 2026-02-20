import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {

  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [Email, setEmail] = useState("");
  const [PW, setPW] = useState("");

  const handleSubmit = async () => {

    if (isLogin) {
      // LOGIN
      const res = await fetch(
        `${import.meta.env.VITE_BK_URL}/api/users/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Email, PW })
        }
      );

      if (!res.ok) {
        alert("Login failed");
        return;
      }

      const data = await res.json();

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("userId", data.userId);

      navigate("/home");

    } else {
      // SIGNUP
      const res = await fetch(
        `${import.meta.env.VITE_BK_URL}/api/users/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email: Email,
            password: PW
          })
        }
      );

      if (!res.ok) {
        alert("Signup failed");
        return;
      }

      alert("Signup successful. Please login.");
      setIsLogin(true);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">

        <h2 className="login-title">
          {isLogin ? "Login" : "Sign Up"}
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
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />

        <button
          className="login-button"
          onClick={handleSubmit}
        >
          {isLogin ? "Login" : "Create Account"}
        </button>

        <div
          className="signup-link"
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