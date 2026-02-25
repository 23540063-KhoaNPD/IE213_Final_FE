import React from "react";
import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>404</h1>
      <h2>Server is not available</h2>
      <p>Please check back later</p>

      <button
        onClick={() => navigate("/login")}
        style={{
          padding: "10px 20px",
          marginTop: "20px",
          cursor: "pointer"
        }}
      >
        Back to Login
      </button>
    </div>
  );
};

export default NotFound;