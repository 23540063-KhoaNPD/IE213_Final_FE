import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const Home = () => {

    const navigate = useNavigate();

    const [socket, setSocket] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [myId, setMyId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");


    function parseJwt(token) {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch {
            return null;
        }
    }

    const deleteRoom = (roomId) => {

        if (!socket) return;

        const confirmDelete = window.confirm("Delete this room?");
        if (!confirmDelete) return;

        socket.emit("delete_room", { roomId });
    };


    const createRoom = () => {
        if (!newRoomName.trim() || !socket) return;

        socket.emit("create_room", {
            roomName: newRoomName
        });

        setNewRoomName("");
        setShowCreate(false);
    };


    useEffect(() => {

        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/");
            return;
        }

        const decoded = parseJwt(token);
        setMyId(decoded?.userId);

        const newSocket = io(process.env.BK_URL, {
            auth: { token }
        });

        newSocket.emit("get_rooms");

        newSocket.on("room_list", (data) => {
            setRooms(data);
        });

        newSocket.on("chat_history", (history) => {
            setMessages(history);
        });

        newSocket.on("receive_msg", (msg) => {
            setMessages(prev => [...prev, msg]);
        });

        newSocket.on("connect_error", (err) => {
            if (err.message === "Unauthorized") {
                localStorage.removeItem("token");
                navigate("/");
            }
        });

        setSocket(newSocket);

        return () => newSocket.disconnect();

    }, [navigate]);

    const joinRoom = (room) => {
        if (!socket) return;

        setCurrentRoom(room);
        setMessages([]);
        socket.emit("join_room", room._id);
    };

    const sendMessage = () => {
        if (!input.trim() || !currentRoom || !socket) return;

        socket.emit("send_msg", {
            roomId: currentRoom._id,
            message: input
        });

        setInput("");
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);

        return date.toLocaleDateString("vi-VN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    };

    const isDifferentDay = (current, previous) => {
        if (!previous) return true;

        const d1 = new Date(current);
        const d2 = new Date(previous);

        return (
            d1.getFullYear() !== d2.getFullYear() ||
            d1.getMonth() !== d2.getMonth() ||
            d1.getDate() !== d2.getDate()
        );
    };


    return (
        <div className="home-container">

            <div className="room-column">

                <h4 className="room-title">Rooms</h4>

                {/* CREATE ROOM BOX GIỐNG ROOM */}
                <div
                    className="room-item create-room-item"
                    onClick={() => setShowCreate(!showCreate)}
                >
                    <div className="room-overlay center">
                        + Create Room
                    </div>
                </div>

                {showCreate && (
                    <div className="create-room-box">
                        <input
                            type="text"
                            placeholder="Room name..."
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") createRoom();
                            }}
                        />
                        <button onClick={createRoom}>Create</button>
                    </div>
                )}

                {rooms.map(room => {

                    const isImage =
                        room.room_bg &&
                        (room.room_bg.startsWith("http") ||
                            room.room_bg.startsWith("/"));

                    const style = isImage
                        ? {
                            backgroundImage: `url(${room.room_bg})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center"
                        }
                        : {
                            backgroundColor: room.room_bg || "#0d6efd"
                        };

                    return (
                        <div
                            key={room._id}
                            className={`room-item ${currentRoom?._id === room._id ? "active" : ""}`}
                            style={style}
                        >

                            {/* CLICK VÀO ROOM */}
                            <div
                                className="room-overlay"
                                onClick={() => joinRoom(room)}
                            >
                                {room.Room_name}
                            </div>

                            {/* NÚT XOÁ */}
                            <div
                                className="delete-room-btn"
                                onClick={(e) => {
                                    e.stopPropagation(); // 👈 ngăn joinRoom
                                    deleteRoom(room._id);
                                }}
                            >
                                ✕
                            </div>

                        </div>
                    );
                })}


            </div>



            <div className="chat-column">

                <div className="chat-header">
                    {currentRoom
                        ? ` ${currentRoom.Room_name}`
                        : "Select a room"}
                </div>

                <div className="chat-messages">
                    {messages.map((msg, index) => {

                        const previousMsg = messages[index - 1];
                        const showDate = isDifferentDay(
                            msg.Timestamp,
                            previousMsg?.Timestamp
                        );

                        const isMe =
                            String(msg.Sender_id) === String(myId);

                        return (
                            <React.Fragment key={msg._id}>

                                {/* DATE SEPARATOR */}
                                {showDate && (
                                    <div className="date-separator">
                                        {formatDate(msg.Timestamp)}
                                    </div>
                                )}

                                <div
                                    className={`chat-message ${isMe ? "me" : "other"}`}
                                >
                                    {!isMe && (
                                        <div className="msg-header">
                                            {msg.Sender_name || "User"}
                                        </div>
                                    )}

                                    <div className="msg-content">
                                        {msg.Content}
                                    </div>

                                    <div className="msg-time">
                                        {new Date(msg.Timestamp)
                                            .toLocaleTimeString("vi-VN", {
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                    </div>
                                </div>

                            </React.Fragment>
                        );
                    })}

                </div>

                {currentRoom && (
                    <div className="chat-input-area">
                        <input
                            className="chat-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") sendMessage();
                            }}
                            placeholder="Type message..."
                        />

                        <button
                            className="send-button"
                            onClick={sendMessage}
                        >
                            Send
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default Home;
