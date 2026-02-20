import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const DEFAULT_AVATAR = "/default-avatar.png";

const Home = () => {
    const navigate = useNavigate();
    const bottomRef = useRef(null);

    const [socket, setSocket] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");
    const [myAvatar, setMyAvatar] = useState(DEFAULT_AVATAR);
    const [myId, setMyId] = useState(null);

    /* ================= JWT ================= */

    function parseJwt(token) {
        try {
            return JSON.parse(atob(token.split(".")[1]));
        } catch {
            return null;
        }
    }

    /* ================= SOCKET INIT ================= */

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return navigate("/");

        const decoded = parseJwt(token);
        setMyId(decoded?.userId);

        const newSocket = io(
            import.meta.env.VITE_BK_URL || "http://localhost:8080",
            { auth: { token } }
        );

        newSocket.emit("get_rooms");

        newSocket.on("room_list", (data) => {
            setRooms(data);
        });

        newSocket.on("chat_history", (history) => {
            setMessages(history);
        });

        newSocket.on("receive_msg", (msg) => {
            setMessages((prev) => [...prev, msg]);
        });

        newSocket.on("my_profile", (profile) => {
            if (profile?.avatar) {
                setMyAvatar(profile.avatar);
                localStorage.setItem("avatar", profile.avatar);
            }
        });

        newSocket.on("avatar_updated", ({ userId, avatar }) => {
            if (String(userId) === String(myId)) {
                setMyAvatar(avatar);
            }

            setMessages((prev) =>
                prev.map((msg) =>
                    String(msg.Sender_id) === String(userId)
                        ? { ...msg, Sender_avatar: avatar }
                        : msg
                )
            );
        });

        setSocket(newSocket);
        return () => newSocket.disconnect();
    }, [navigate]);

    /* ================= LOAD AVATAR ================= */

    useEffect(() => {
        const savedAvatar = localStorage.getItem("avatar");
        if (savedAvatar) setMyAvatar(savedAvatar);
    }, []);

    /* ================= AUTO SCROLL ================= */

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    /* ================= ROOM ================= */

    const joinRoom = (room) => {
        if (!socket) return;
        setCurrentRoom(room);
        setMessages([]);
        socket.emit("join_room", room._id);
    };

    const createRoom = () => {
        if (!newRoomName.trim() || !socket) return;
        socket.emit("create_room", { roomName: newRoomName });
        setNewRoomName("");
        setShowCreate(false);
    };

    const deleteRoom = (roomId) => {
        if (!socket) return;
        if (!window.confirm("Delete this room?")) return;
        socket.emit("delete_room", { roomId });
    };

    const updateRoom = (room) => {
        if (!socket) return;
        const newName = prompt("Enter new room name:", room.Room_name);
        if (!newName || !newName.trim()) return;

        socket.emit("update_room", {
            roomId: room._id,
            newName: newName.trim(),
        });
    };

    /* ================= MESSAGE ================= */

    const sendMessage = () => {
        if (!input.trim() || !currentRoom || !socket) return;

        socket.emit("send_msg", {
            roomId: currentRoom._id,
            message: input,
        });

        // console.log("Sending:", currentRoom._id, input);

        setInput("");
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("vi-VN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
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

    /* ================= RENDER ================= */

    return (
        <div className="home-container">
            {/* ================= ROOM COLUMN ================= */}
            <div className="room-column">
                <h4 className="room-title">Rooms</h4>

                <div
                    className="room-item create-room-item"
                    onClick={() => setShowCreate(!showCreate)}
                >
                    <div className="room-overlay center">+ Create Room</div>
                </div>

                {showCreate && (
                    <div className="create-room-box">
                        <input
                            type="text"
                            placeholder="Room name..."
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && createRoom()}
                        />
                        <button onClick={createRoom}>Create</button>
                    </div>
                )}

                {rooms.map((room) => {
                    const isImage =
                        room.room_bg &&
                        (room.room_bg.startsWith("http") ||
                            room.room_bg.startsWith("/"));

                    const style = isImage
                        ? { backgroundImage: `url(${room.room_bg})` }
                        : { backgroundColor: room.room_bg || "#0d6efd" };

                    return (
                        <div
                            key={room._id}
                            className={`room-item ${currentRoom?._id === room._id ? "active" : ""
                                }`}
                            style={style}
                            onClick={() => joinRoom(room)}
                        >
                            <div className="room-name">{room.Room_name}</div>

                            <div className="room-actions">
                                <div
                                    className="room-btn delete-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteRoom(room._id);
                                    }}
                                >
                                    ✕
                                </div>

                                <div
                                    className="room-btn edit-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateRoom(room);
                                    }}
                                >
                                    ✏
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ================= CHAT COLUMN ================= */}
            <div className="chat-column">
                <div className="chat-header">
                    <div>{currentRoom ? currentRoom.Room_name : "Select a room"}</div>

                    <label className="avatar-upload">
                        <img
                            src={myAvatar}
                            className="my-avatar"
                            alt="my avatar"
                            onError={(e) => (e.target.src = DEFAULT_AVATAR)}
                        />
                        <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;

                                const formData = new FormData();
                                formData.append("avatar", file);

                                const res = await fetch(
                                    `${import.meta.env.VITE_BK_URL}/upload-avatar`,
                                    {
                                        method: "POST",
                                        headers: {
                                            Authorization: `Bearer ${localStorage.getItem("token")}`,
                                        },
                                        body: formData,
                                    }
                                );

                                const data = await res.json();

                                if (data.avatar) {
                                    setMyAvatar(data.avatar);
                                    localStorage.setItem("avatar", data.avatar);
                                }
                            }}
                        />
                    </label>
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
                            <div key={msg._id || index}>
                                {showDate && (
                                    <div className="date-separator">
                                        {formatDate(msg.Timestamp)}
                                    </div>
                                )}

                                <div
                                    className={`chat-message-wrapper ${isMe ? "me" : "other"
                                        }`}
                                >
                                    {!isMe && (
                                        <img
                                            className="chat-avatar"
                                            src={msg.Sender_avatar || DEFAULT_AVATAR}
                                            alt="avatar"
                                        />
                                    )}

                                    <div
                                        className={`chat-message ${isMe ? "me" : "other"
                                            }`}
                                    >
                                        {!isMe && (
                                            <div className="msg-header">
                                                {msg.Sender_name || "User"}
                                            </div>
                                        )}

                                        <div>{msg.Content}</div>

                                        <div className="msg-time">
                                            {new Date(msg.Timestamp).toLocaleTimeString(
                                                "vi-VN",
                                                { hour: "2-digit", minute: "2-digit" }
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div ref={bottomRef}></div>
                </div>

                {currentRoom && (
                    <div className="chat-input-area">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder="Type message..."
                        />
                        <button onClick={sendMessage}>Send</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Home;