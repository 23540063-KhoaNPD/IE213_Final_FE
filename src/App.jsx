
import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from './page/login.jsx'; // Import the login component
import 'bootstrap/dist/css/bootstrap.min.css'; // Ensure bootstrap is loaded
import "./App.css"
import Home from './page/home.jsx'
import ProtectedRoute from './page/ProtectedRoute.jsx';

function App() {

  return (
    <>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>} />
      </Routes>

    </>

  );


}

export default App;