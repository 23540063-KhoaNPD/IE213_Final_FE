import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import FormGroup from "react-bootstrap/esm/FormGroup";
import "./Login.css";
import UserService from "../helper/userService.js";

const Login = () => {

    const navigate = useNavigate();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm();

    const onSubmit = async (formData) => {
        try {
            const response = await UserService.login({
                Email: formData.Email,
                PW: formData.PW
            });

            console.log("Login response:", response);

            if (!response?.token) {
                alert("Login failed");
                return;
            }

            localStorage.setItem("token", response.token);

            console.log("Navigating...");
            navigate("/home");

        } catch (err) {
            console.error(err);
            alert("Login error");
        }
    };


    return (
        <div className="App-container">
            <Form
                className="custom-form column-layout"
                onSubmit={handleSubmit(onSubmit)}
            >
                <h1 className="welcome-text">Welcome</h1>
                <p className="sub-text">Please enter your details to continue</p>

                {/* Email */}
                <FormGroup className="form-field">
                    <Form.Control
                        className="large-input hover-animation"
                        type="text"
                        placeholder="Enter email"
                        {...register("Email", { required: "Email is required" })}
                    />
                    {errors.Email && (
                        <p className="error-text">{errors.Email.message}</p>
                    )}
                </FormGroup>

                {/* Password */}
                <FormGroup className="form-field">
                    <Form.Control
                        className="large-input hover-animation"
                        type="password"
                        placeholder="Enter password"
                        {...register("PW", {
                            required: "Password is required",
                            minLength: {
                                value: 3,
                                message: "Minimum 3 characters"
                            }
                        })}
                    />
                    {errors.PW && (
                        <p className="error-text">{errors.PW.message}</p>
                    )}
                </FormGroup>

                <div className="button-group">
                    <Button
                        type="submit"
                        className="large-btn primary-btn"
                        variant="primary"
                    >
                        Submit
                    </Button>

                    <Button
                        type="button"
                        className="large-btn secondary-btn"
                        variant="outline-primary"
                        onClick={() => navigate("/signup")}
                    >
                        Sign Up
                    </Button>
                </div>
            </Form>
        </div>
    );
};

export default Login;
