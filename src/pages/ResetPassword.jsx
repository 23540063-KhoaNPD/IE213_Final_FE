import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "./Auth.css";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    const res = await fetch(
      `${import.meta.env.VITE_BK_URL}/api/users/reset-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password })
      }
    );

    if (!res.ok) {
      alert("Invalid or expired token");
      return;
    }

    alert("Password updated successfully");
    navigate("/");
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-title">Create New Password</h2>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="auth-button" onClick={handleSubmit}>
          Update Password
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