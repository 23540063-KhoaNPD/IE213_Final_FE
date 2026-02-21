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
    const [myName, setMyName] = useState("");
    const [previewImage, setPreviewImage] = useState(null);

    /* ================= JWT ================= */

    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const binary = atob(base64);
            const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
            const decoded = new TextDecoder("utf-8").decode(bytes);
            return JSON.parse(decoded);
        } catch (e) {
            return null;
        }
    }

    /* ================= SOCKET INIT ================= */

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return navigate("/");

        const decoded = parseJwt(token);
        setMyId(decoded?.userId);
        setMyName(decoded?.username || "User");
        // console.log(`check user name`,decoded?.username )

        const newSocket = io(
            import.meta.env.VITE_BK_URL || "http://localhost:8080",
            { auth: { token } }
        );

        newSocket.on("my_profile", (profile) => {
            if (profile?.avatar) {
                setMyAvatar(profile.avatar);
                localStorage.setItem("avatar", profile.avatar);
            }

            if (profile?.name) {
                setMyName(profile.name);
            }
        });

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

        // newSocket.on("my_profile", (profile) => {
        //     if (profile?.avatar) {
        //         setMyAvatar(profile.avatar);
        //         localStorage.setItem("avatar", profile.avatar);
        //     }
        // });

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

        /* ===== MESSAGE UPDATE ===== */
        newSocket.on("message_updated", (updatedMsg) => {

            setMessages((prev) =>
                prev.map((msg) =>
                    msg._id.toString() === updatedMsg._id.toString()
                        ? { ...updatedMsg }   // 🔥 dùng toàn bộ object mới
                        : msg
                )
            );
        });

        /* ===== MESSAGE DELETE ===== */
        newSocket.on("message_deleted", ({ messageId }) => {
            setMessages((prev) =>
                prev.filter((msg) => String(msg._id) !== String(messageId))
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

    const updateRoom = async (room) => {
        if (!socket) return;

        const newName = prompt("Enter new room name:", room.Room_name);
        if (!newName || !newName.trim()) return;

        const useImage = window.confirm("Use image background? (Cancel = use color)");

        let newBackground = room.room_bg;

        if (useImage) {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const formData = new FormData();
                formData.append("image", file);

                const res = await fetch(
                    `${import.meta.env.VITE_BK_URL}/api/upload-room-bg`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${localStorage.getItem("token")}`
                        },
                        body: formData
                    }
                );

                const data = await res.json();

                if (data.imageUrl) {
                    socket.emit("update_room", {
                        roomId: room._id,
                        newName: newName.trim(),
                        newBackground: data.imageUrl
                    });
                }
            };

            input.click();

        } else {
            const color = prompt("Enter background color (hex or name):", "#0d6efd");
            if (!color) return;

            socket.emit("update_room", {
                roomId: room._id,
                newName: newName.trim(),
                newBackground: color
            });
        }
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

    const deleteMessage = (messageId) => {
        if (!socket) return;
        if (!window.confirm("Delete this message?")) return;

        socket.emit("delete_message", {
            messageId,
            roomId: currentRoom._id
        });
    };

    const updateMessage = async (msg) => {
        if (!socket || !currentRoom) return;

        /* ===== TEXT MESSAGE ===== */
        if (msg.Type !== "Image") {
            const newContent = prompt("Edit message:", msg.Content);
            if (!newContent || !newContent.trim()) return;

            socket.emit("update_message", {
                messageId: msg._id,
                newContent: newContent.trim(),
                roomId: currentRoom._id
            });

            return;
        }

        /* ===== IMAGE MESSAGE ===== */
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append("image", file);
            formData.append("roomId", currentRoom._id); // 🔥 THÊM DÒNG NÀY

            const res = await fetch(
                `${import.meta.env.VITE_BK_URL}/api/upload-image`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`
                    },
                    body: formData
                }
            );

            const data = await res.json();

            if (data.imageUrl) {
                socket.emit("update_message", {
                    messageId: msg._id,
                    newContent: data.imageUrl,
                    roomId: currentRoom._id
                });
            }
        };

        input.click();
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

                    <div className="user-info">
                        <div className="my-name">{myName}</div>

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
                                        `${import.meta.env.VITE_BK_URL}/api/upload-avatar`,
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

                        // console.log("RENDER MESSAGE:", msg);

                        // if (msg.Type === "Image") {
                        //     console.log("IMAGE CONTENT:", msg.Content);
                        // }

                        return (
                            <div key={`${msg._id}-${msg.Edited}`}>
                                {showDate && (
                                    <div className="date-separator">
                                        {formatDate(msg.Timestamp)}
                                    </div>
                                )}

                                <div
                                    className={`chat-message-wrapper ${isMe ? "me" : "other"}`}
                                >
                                    {!isMe && (
                                        <img
                                            className="chat-avatar"
                                            src={msg.Sender_avatar || DEFAULT_AVATAR}
                                            alt="avatar"
                                        />
                                    )}

                                    {msg.Type === "Image" ? (

                                        /* ===== IMAGE MESSAGE ===== */
                                        <div className={`image-message ${isMe ? "me" : "other"}`}>

                                            <img
                                                src={`${msg.Content}?v=${msg.Edited ? msg.Timestamp : ""}`}
                                                alt="chat-img"
                                                className="chat-image"
                                                onClick={() => setPreviewImage(msg.Content)}
                                            />

                                            {isMe && (
                                                <div className="msg-actions">
                                                    <span
                                                        className="msg-edit"
                                                        onClick={() => updateMessage(msg)}
                                                    >
                                                        ✏
                                                    </span>
                                                    <span
                                                        className="msg-delete"
                                                        onClick={() => deleteMessage(msg._id)}
                                                    >
                                                        🗑
                                                    </span>
                                                </div>
                                            )}

                                            <div className="msg-time">
                                                {new Date(msg.Timestamp).toLocaleTimeString("vi-VN", {
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                })}
                                            </div>

                                        </div>

                                    ) : (

                                        /* ===== TEXT MESSAGE ===== */
                                        <div
                                            className={`chat-message ${isMe ? "me" : "other"}`}
                                        >
                                            {!isMe && (
                                                <div className="msg-header">
                                                    {msg.Sender_name || "User"}
                                                </div>
                                            )}

                                            <div>{msg.Content}</div>

                                            {msg.Edited && (
                                                <div className="edited-label">(edited)</div>
                                            )}

                                            <div className="msg-time">
                                                {new Date(msg.Timestamp).toLocaleTimeString("vi-VN", {
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                })}
                                            </div>

                                            {/* ===== ACTION BUTTONS (only my message) ===== */}
                                            {isMe && (
                                                <div className="msg-actions">
                                                    <span
                                                        className="msg-edit"
                                                        onClick={() => updateMessage(msg)}
                                                    >
                                                        ✏
                                                    </span>
                                                    <span
                                                        className="msg-delete"
                                                        onClick={() => deleteMessage(msg._id)}
                                                    >
                                                        🗑
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div ref={bottomRef}></div>
                </div>

                {currentRoom && (
                    <div className="chat-input-area">

                        <label className="image-upload-btn">
                            📷
                            <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file || !currentRoom) return;

                                    const formData = new FormData();
                                    formData.append("image", file);
                                    formData.append("roomId", currentRoom._id);

                                    const res = await fetch(
                                        `${import.meta.env.VITE_BK_URL}/api/upload-message`,
                                        {
                                            method: "POST",
                                            headers: {
                                                Authorization: `Bearer ${localStorage.getItem("token")}`
                                            },
                                            body: formData
                                        }
                                    );

                                    const data = await res.json();

                                    if (data.message) {
                                        socket.emit("image_msg", data.message);
                                    }
                                }}
                            />
                        </label>

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

            {previewImage && (
                <div className="image-modal" onClick={() => setPreviewImage(null)}>
                    <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                        <img src={previewImage} alt="preview" />

                        <div className="image-modal-actions">
                            <a
                                href={previewImage}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Download
                            </a>

                            <button onClick={() => setPreviewImage(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;