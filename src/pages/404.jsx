import React from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>404</h1>
      <h2>Server không phản hồi</h2>
      <p>Vui lòng kiểm tra lại kết nối hoặc thử lại sau.</p>

      <button
        onClick={() => navigate("/login")}
        style={{
          padding: "10px 20px",
          marginTop: "20px",
          cursor: "pointer"
        }}
      >
        Quay lại Login
      </button>
    </div>
  );
};

export default NotFound;