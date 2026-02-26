import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./Home.css";

import { useLayoutEffect } from "react";

const DEFAULT_AVATAR = "/default-avatar.png";

const Home = () => {
    const navigate = useNavigate();
    const bottomRef = useRef(null);

    const messagesRef = useRef(null);
    const shouldAutoScroll = useRef(true);

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("avatar");
        navigate("/");
    };

    const backendURL = import.meta.env.VITE_BK_URL || "http://localhost:8080";

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
    const [isPrivateRoom, setIsPrivateRoom] = useState(false);

    const checkIfNearBottom = () => {
        const el = messagesRef.current;
        if (!el) return;

        const threshold = 100; // px
        const isNearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

        shouldAutoScroll.current = isNearBottom;
    };

    const updateName = async () => {
        const newName = prompt("Enter new name:", myName);
        if (!newName || !newName.trim()) return;

        try {
            const token = localStorage.getItem("token");
            if (!token) {
                logout();
                return;
            }

            const res = await fetch(
                `${import.meta.env.VITE_BK_URL}/api/users/update-name`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`  // 🔥 QUAN TRỌNG
                    },
                    body: JSON.stringify({
                        name: newName.trim()
                    })
                }
            );

            if (res.status === 401) {
                // logout();
                return;
            }

            const data = await res.json();

            if (data.name) {
                setMyName(data.name);

                if (socket) {
                    socket.emit("update_name", { name: data.name });
                }
            }

        } catch (err) {
            console.error("Update name failed:", err);
        }
    };

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

    function isTokenValid(token) {
        const decoded = parseJwt(token);
        if (!decoded) return false;

        if (!decoded.exp) return false;

        const currentTime = Date.now() / 1000; // đổi sang giây

        return decoded.exp > currentTime;
    }

    useEffect(() => {
        const el = messagesRef.current;
        if (!el) return;

        el.addEventListener("scroll", checkIfNearBottom);

        return () => {
            el.removeEventListener("scroll", checkIfNearBottom);
        };
    }, []);

    /* ================= SOCKET INIT ================= */

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            logout();
            return;
        }

        if (!isTokenValid(token)) {
            logout();
            return;
        }

        const decoded = parseJwt(token);
        setMyId(decoded?.userId);
        setMyName(decoded?.username || "User");

        const newSocket = io(
            import.meta.env.VITE_BK_URL || "http://localhost:8080",
            { auth: { token } }
        );

        newSocket.on("connect_error", (err) => {
            if (err.message === "Unauthorized") {
                logout();
            }
        });

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

        newSocket.on("name_updated", ({ userId, name }) => {

            if (String(userId) === String(myId)) {
                setMyName(name);
            }

            setMessages((prev) =>
                prev.map((msg) =>
                    String(msg.Sender_id) === String(userId)
                        ? { ...msg, Sender_name: name }
                        : msg
                )
            );
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

    useLayoutEffect(() => {
        const el = messagesRef.current;
        if (!el) return;

        if (shouldAutoScroll.current) {
            el.scrollTop = el.scrollHeight;
        }
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

    const sendImage = async (file) => {
        if (!file || !currentRoom || !socket) return;

        const formData = new FormData();
        formData.append("image", file);
        formData.append("roomId", currentRoom._id);

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

        if (res.status === 401) {
            logout();
            return;
        }

        const data = await res.json();

        if (data.imageUrl) {
            socket.emit("send_msg", {
                roomId: currentRoom._id,
                message: data.imageUrl,
                type: "Image"
            });
        }
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

        const isImageMessage =
            msg.Type === "Image" ||
            (typeof msg.Content === "string" &&
                msg.Content.startsWith("http"));

        /* ================= TEXT ================= */
        if (!isImageMessage) {
            const newContent = prompt("Edit message:", msg.Content);
            if (!newContent || !newContent.trim()) return;

            socket.emit("update_message", {
                messageId: msg._id,
                newContent: newContent.trim(),
                roomId: currentRoom._id
            });

            return;
        }

        /* ================= IMAGE ================= */
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";

        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const formData = new FormData();
                formData.append("image", file);
                formData.append("roomId", currentRoom._id);

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

                if (res.status === 401) {
                    logout();
                    return;
                }

                const data = await res.json();

                if (data.imageUrl) {
                    socket.emit("update_message", {
                        messageId: msg._id,
                        newContent: data.imageUrl,
                        roomId: currentRoom._id
                    });
                }

            } catch (err) {
                console.error("Upload failed:", err);
            }
        };

        fileInput.click();
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

        <div className="messenger-layout">

            {/* ===== SIDEBAR ===== */}

            <div className="sidebar">

                <div className="sidebar-header">

                    Chats

                </div>

                <div
                    className="create-room"
                    onClick={() => setShowCreate(!showCreate)}
                >
                    + Create Room
                </div>

                {showCreate && (

                    <div className="create-room-box">

                        <input
                            placeholder="Room name..."
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && createRoom()}
                        />

                        <button onClick={createRoom}>
                            Create
                        </button>

                    </div>

                )}

                <div className="room-list">

                    {rooms.map(room => {

                        const isImage =
                            room.room_bg &&
                            (room.room_bg.startsWith("http")
                                || room.room_bg.startsWith("/"));

                        const style = isImage
                            ? {
                                backgroundImage: `url(${room.room_bg})`,
                                backgroundSize: "cover"
                            }
                            : {
                                backgroundColor:
                                    room.room_bg || "#0084ff"
                            };

                        return (

                            <div
                                key={room._id}
                                className={`room-item ${currentRoom?._id === room._id ? "active" : ""
                                    }`}
                                onClick={() => joinRoom(room)}
                            >


                                <div className="room-avatar">

                                    <img
                                        src={
                                            room.room_bg &&
                                                (room.room_bg.startsWith("http") ||
                                                    room.room_bg.startsWith("/"))
                                                ? room.room_bg
                                                : DEFAULT_AVATAR
                                        }
                                    />

                                </div>

                                <div className="room-info">

                                    <div className="room-name">

                                        {room.Room_name}

                                    </div>

                                    <div className="room-actions">

                                        <div className="room-actions">
                                            <button
                                                className="action-btn edit"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateRoom(room);
                                                }}
                                            >
                                                ✎
                                            </button>

                                            <button
                                                className="action-btn delete"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteRoom(room._id);
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>

                                    </div>

                                </div>
                            </div>

                        );

                    })}

                </div>

            </div>



            {/* ===== CHAT ===== */}

            <div className="chat">

                {/* HEADER */}

                <div className="chat-top">

                    <div>

                        {currentRoom
                            ? currentRoom.Room_name
                            : "Select a room"}

                    </div>

                    <div className="profile">

                        <span className="my-name">
                            <button
                                className="edit-name-btn action-btn edit"
                                onClick={updateName}
                            >
                                ✎
                            </button>
                            {myName}
                        </span>

                        <label>

                            <img
                                src={myAvatar}
                                className="avatar"
                                alt="avatar"
                                onError={(e) =>
                                    e.target.src = DEFAULT_AVATAR
                                }
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

                                                Authorization:
                                                    `Bearer ${localStorage.getItem("token")}`

                                            },

                                            body: formData

                                        }

                                    );

                                    const data = await res.json();

                                    if (data.avatar) {

                                        setMyAvatar(data.avatar);

                                        localStorage.setItem(
                                            "avatar",
                                            data.avatar
                                        );

                                    }

                                }}

                            />

                        </label>

                    </div>

                </div>



                {/* ===== MESSAGE AREA ===== */}

                <div className="messages" ref={messagesRef}>

                    {messages.map((msg, index) => {

                        // console.log("MSG OBJECT:", msg);

                        const previousMsg =
                            messages[index - 1];

                        const showDate =
                            isDifferentDay(
                                msg.Timestamp,
                                previousMsg?.Timestamp
                            );

                        const isMe =
                            String(msg.Sender_id)
                            === String(myId);

                        return (

                            <div key={`${msg._id}-${msg.Edited}`}>

                                {showDate && (

                                    <div className="date">

                                        {formatDate(msg.Timestamp)}

                                    </div>

                                )}

                                <div className={`message-row ${isMe ? "me" : "other"}`}>

                                    {/* ===== TIME LEFT (CHỈ HIỆN VỚI isMe) ===== */}
                                    {isMe && (
                                        <div className="time time-left">
                                            {new Date(msg.Timestamp).toLocaleTimeString("vi-VN", {
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </div>
                                    )}

                                    {!isMe && (
                                        <img
                                            className="msg-avatar"
                                            src={msg.Sender_avatar || DEFAULT_AVATAR}
                                            alt="avatar"
                                        />
                                    )}

                                    <div className={`bubble ${isMe ? "me" : "other"}`}>

                                        {!isMe && (
                                            <div className="sender">
                                                {msg.Sender_name || "User"}
                                            </div>
                                        )}

                                        {msg.Type === "Image" || msg.Content.startsWith("http") ? (
                                            <img
                                                src={msg.Content}
                                                className="msg-img"
                                                alt="chat"
                                                onClick={() => setPreviewImage(msg.Content)}
                                            />
                                        ) : (
                                            <div className="text-content">
                                                {msg.Content}
                                            </div>
                                        )}

                                        {isMe && (
                                            <div className="message-actions">
                                                <button
                                                    className="action-btn edit"
                                                    onClick={() => updateMessage(msg)}
                                                >
                                                    ✎
                                                </button>

                                                <button
                                                    className="action-btn delete"
                                                    onClick={() => deleteMessage(msg._id)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}

                                    </div>

                                    {/* ===== TIME RIGHT (CHỈ HIỆN VỚI OTHER) ===== */}
                                    {!isMe && (
                                        <div className="time time-right">
                                            {new Date(msg.Timestamp).toLocaleTimeString("vi-VN", {
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </div>
                                    )}

                                </div>

                            </div>

                        );

                    })}

                    <div ref={bottomRef}></div>

                </div>



                {/* ===== INPUT ===== */}

                {currentRoom && (

                    <div className="input-area">

                        {/* ICON CHỌN ẢNH */}
                        <label className="image-upload">
                            📷
                            <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) sendImage(file);
                                }}
                            />
                        </label>

                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder="Aa"
                        />

                        <button onClick={sendMessage}>
                            ➤
                        </button>

                    </div>

                )}

            </div>



            {/* IMAGE PREVIEW */}

            {previewImage && (

                <div

                    className="image-modal"

                    onClick={() => setPreviewImage(null)}

                >

                    <div

                        className="image-modal-content"

                        onClick={(e) => e.stopPropagation()}

                    >

                        <img

                            src={previewImage}

                            alt="preview"

                        />

                        <button

                            className="close-preview"

                            onClick={() => setPreviewImage(null)}

                        >

                            ✕

                        </button>

                    </div>

                </div>

            )}

        </div>

    );
};

export default Home;