import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const backendUrl =
    import.meta.env.VITE_BK_URL || "http://localhost:8080";

  const handleSubmit = async () => {
    if (!email) {
      alert("Please enter your email");
      return;
    }

    try {
      console.log('BK_URL: ', backendUrl);

      const res = await fetch(
        `${backendUrl}/api/users/request-reset`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        }
      );

      // Không cần check tồn tại email để tránh lộ user
      alert("If this email exists, reset instructions were sent.");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Server error. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-title">Reset Password</h2>

        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button className="auth-button" onClick={handleSubmit}>
          Send Reset Link
        </button>

        <div
          className="auth-link"
          onClick={() => navigate("/")}
        >
          Back to login
        </div>
      </div>
    </div>
  );
}