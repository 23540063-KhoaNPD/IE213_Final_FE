import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import { FaEdit, FaTrash, FaEllipsisV } from "react-icons/fa";

import { useLayoutEffect } from "react";

const DEFAULT_AVATAR = "/default-avatar.png";

const Home = () => {
    const navigate = useNavigate();
    const bottomRef = useRef(null);
    const messagesRef = useRef(null);



    const backendURL = import.meta.env.VITE_BK_URL || "http://localhost:8080";

    const IDLE_TIME = 15 * 60 * 1000; // 15 phút

    const idleTimerRef = useRef(null);

    const resetIdleTimer = () => {
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
        }

        idleTimerRef.current = setTimeout(() => {
            console.log("User idle → logout");
            logout();
        }, IDLE_TIME);
    };

    const handleSave = (msg) => {
        if (!editContent.trim()) return;

        socket.emit("update_message", {
            messageId: msg._id,
            newContent: editContent.trim(),
            roomId: currentRoom._id
        });

        setEditingMsg(null);
    };


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
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [showUsers, setShowUsers] = useState(false);
    const [emailInput, setEmailInput] = useState("");
    const [foundUser, setFoundUser] = useState(null);
    const [unreadRooms, setUnreadRooms] = useState({});
    const [openMenuId, setOpenMenuId] = useState(null);
    const [editingMsg, setEditingMsg] = useState(null);
    const [editContent, setEditContent] = useState("");
    const [deletingMsg, setDeletingMsg] = useState(null);


    const currentRoomRef = useRef(null);
    const unreadRoomsRef = useRef({});


    const logout = () => {
        if (socket) {
            socket.disconnect();
        }
        localStorage.removeItem("token");
        localStorage.removeItem("avatar");
        navigate("/");
    };

    const startEdit = (msg) => {
        setEditingMsg(msg);

        const isImage =
            msg.Type === "Image" ||
            msg.Content.startsWith("http");

        if (!isImage) {
            setEditContent(msg.Content);
        } else {
            // mở file picker luôn
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";

            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

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

                const data = await res.json();

                if (data.imageUrl) {
                    socket.emit("update_message", {
                        messageId: msg._id,
                        newContent: data.imageUrl,
                        roomId: currentRoom._id
                    });
                }

                setEditingMsg(null);
            };

            input.click();
        }
    };

    const renderContent = (msg) => {
        const isImage =
            msg.Type === "Image" ||
            msg.Content.startsWith("http");

        // ===== IMAGE =====
        if (isImage) {
            return (
                <img
                    src={msg.Content}
                    className="msg-img"
                    alt="chat"
                    onClick={() => setPreviewImage(msg.Content)}
                />
            );
        }

        // ===== TEXT (EDIT MODE) =====
        if (editingMsg?._id === msg._id) {
    return (
        <div className="edit-box">
            <input
                className="edit-input"
                value={editContent}
                autoFocus
                onChange={(e) => setEditContent(e.target.value)}
            />

            <div className="edit-actions">
                <button
                    className="save-btn"
                    onClick={() => {
                        socket.emit("update_message", {
                            messageId: msg._id,
                            newContent: editContent,
                            roomId: currentRoom._id
                        });
                        setEditingMsg(null);
                    }}
                >
                    Save
                </button>

                <button
                    className="cancel-btn"
                    onClick={() => setEditingMsg(null)}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

        // ===== TEXT NORMAL =====
        return <div className="text-content">{msg.Content}</div>;
    };


    const checkIfNearBottom = () => {
        const el = messagesRef.current;
        if (!el) return;

        const threshold = 100; // px
        const isNearBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

    };

    const createDirectRoom = (targetUserId) => {
        if (!socket) return;

        socket.emit("create_direct_room", { targetUserId });
    };

    const updateName = async () => {
        const newName = prompt("Enter new name:", myName);
        if (!newName || !newName.trim()) return;

        const trimmedName = newName.trim();

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
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        name: trimmedName
                    })
                }
            );

            if (res.status === 401) return;

            // SET NGAY TÊN MỚI
            setMyName(trimmedName);

            // EMIT TÊN MỚI
            if (socket) {
                socket.emit("update_name", { name: trimmedName });
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
        currentRoomRef.current = currentRoom;
    }, [currentRoom]);

    useEffect(() => {
        unreadRoomsRef.current = unreadRooms;
    }, [unreadRooms]);

    useEffect(() => {
        const el = messagesRef.current;
        if (!el) return;

        el.addEventListener("scroll", checkIfNearBottom);

        return () => {
            el.removeEventListener("scroll", checkIfNearBottom);
        };
    }, []);

    useEffect(() => {
        const events = ["click", "keydown", "scroll", "mousemove"];

        const handleActivity = () => {
            resetIdleTimer();
        };

        events.forEach(event =>
            window.addEventListener(event, handleActivity)
        );

        // start timer lần đầu
        resetIdleTimer();

        return () => {
            events.forEach(event =>
                window.removeEventListener(event, handleActivity)
            );
            clearTimeout(idleTimerRef.current);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = () => {
            setOpenMenuId(null);
        };

        window.addEventListener("click", handleClickOutside);

        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const token = localStorage.getItem("token");

            if (!token || !isTokenValid(token)) {
                logout();
            }
        }, 60 * 1000); // mỗi 1 phút

        return () => clearInterval(interval);
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

        const newSocket = io(
            import.meta.env.VITE_BK_URL || "http://localhost:8080",
            { auth: { token } }
        );

        newSocket.on("connect_error", (err) => {
            resetIdleTimer();
            if (err.message === "Unauthorized") {
                logout();
            }
        });

        newSocket.on("direct_room_ready", (room) => {
            resetIdleTimer();
            setCurrentRoom(room);
            setMessages([]);
            newSocket.emit("join_room", room._id);
        });

        newSocket.on("my_profile", (profile) => {
            resetIdleTimer();
            if (profile?.avatar) {
                setMyAvatar(profile.avatar);
                localStorage.setItem("avatar", profile.avatar);
            }

            if (profile?.username) {
                setMyName(profile.username);
            }
        });

        newSocket.emit("get_rooms");

        newSocket.emit("get_users");

        newSocket.on("user_list", (data) => {
            resetIdleTimer();
            const decoded = parseJwt(localStorage.getItem("token"));
            const currentUserId = decoded?.userId;

            // console.log("USER LIST FROM SERVER:", data);

            setUsers(
                data.filter(u => String(u._id) !== String(currentUserId))
            );
        });

        newSocket.on("room_list", (data) => {
            resetIdleTimer();
            setRooms(data);
        });

        newSocket.on("chat_history", (history) => {
            resetIdleTimer();
            setMessages(history);
        });

        newSocket.on("receive_msg", (msg) => {
            resetIdleTimer();

            const roomId = String(msg.Room_id);
            const currentId = String(currentRoomRef.current?._id);

            console.log("MSG ROOM:", roomId);
            console.log("CURRENT ROOM:", currentId);
            console.log("UNREAD BEFORE:", unreadRoomsRef.current);

            if (roomId === currentId) {
                setMessages(prev => [...prev, msg]);
            } else {
                setUnreadRooms(prev => {
                    const updated = {
                        ...prev,
                        [roomId]: true
                    };

                    unreadRoomsRef.current = updated; // sync ngay lập tức
                    return updated;
                });
            }

        });

        // newSocket.on("my_profile", (profile) => {
        //     if (profile?.avatar) {
        //         setMyAvatar(profile.avatar);
        //         localStorage.setItem("avatar", profile.avatar);
        //     }
        // });

        newSocket.on("room_created", (room) => {
            resetIdleTimer();
            setRooms(prev => [...prev, room]);
        });

        newSocket.on("name_updated", ({ userId, name }) => {
            resetIdleTimer();

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
            resetIdleTimer();
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
            resetIdleTimer();

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
            resetIdleTimer();
            setMessages((prev) =>
                prev.filter((msg) => String(msg._id) !== String(messageId))
            );
        });

        newSocket.on("user_found", (user) => {
            resetIdleTimer();
            setFoundUser(user);
        });

        newSocket.on("user_not_found", () => {
            resetIdleTimer();
            alert("User not found");
            setFoundUser(null);
        });


        newSocket.on("room_hidden", ({ roomId }) => {
            resetIdleTimer();
            setRooms(prev => prev.filter(r => String(r._id) !== String(roomId)));

            if (String(currentRoomRef.current?._id) === String(roomId)) {
                setCurrentRoom(null);
                setMessages([]);
            }
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
        const el = messagesRef.current;
        if (!el) return;

        el.scrollTop = el.scrollHeight;
    }, [messages]);



    /* ================= ROOM ================= */

    const joinRoom = (room) => {
        if (!socket) return;

        setCurrentRoom(room);
        currentRoomRef.current = room;   // ✅ QUAN TRỌNG

        setMessages([]);

        socket.emit("join_room", room._id);

        setUnreadRooms(prev => {
            const updated = { ...prev };
            delete updated[String(room._id)];
            unreadRoomsRef.current = updated;  // ✅ sync ngay
            return updated;
        });
    };

    const createRoom = () => {
        if (!newRoomName.trim() || !socket) return;

        if (isPrivateRoom && !foundUser) {
            alert("Please search and select a user");
            return;
        }

        socket.emit("create_room", {
            roomName: newRoomName.trim(),
            isPrivate: isPrivateRoom,
            targetUserId: foundUser?._id
        });

        setNewRoomName("");
        setEmailInput("");
        setFoundUser(null);
        setIsPrivateRoom(false);
        setShowCreate(false);
    };

    const deleteRoom = (roomId) => {
        if (!socket) return;
        if (!window.confirm("Delete this room?")) return;
        socket.emit("delete_room", { roomId });
    };

    const hideRoom = (roomId) => {
        if (!socket) return;

        socket.emit("hide_room", {
            roomId
        });

        // optimistic UI update (hide instantly)
        setRooms(prev => prev.filter(r => String(r._id) !== String(roomId)));

        // if current room is hidden → reset chat
        if (String(currentRoom?._id) === String(roomId)) {
            setCurrentRoom(null);
            setMessages([]);
        }
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

                {/* ===== HEADER ===== */}
                <div className="sidebar-top">
                    <div className="sidebar-title">Chats</div>

                    <button
                        className="create-btn"
                        onClick={() => setShowCreate(!showCreate)}
                    >
                        ＋
                    </button>
                </div>

                {/* ===== CREATE ROOM ===== */}
                {showCreate && (
                    <div className="create-room-card">
                        <input
                            placeholder="Room name..."
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && createRoom()}
                        />

                        <label className="private-checkbox">
                            <input
                                type="checkbox"
                                checked={isPrivateRoom}
                                onChange={(e) => setIsPrivateRoom(e.target.checked)}
                            />
                            Private 🔒
                        </label>

                        {isPrivateRoom && (
                            <div className="email-search-box">
                                <input
                                    type="email"
                                    placeholder="Search by email..."
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                />
                                <button
                                    onClick={() =>
                                        socket.emit("find_user_by_email", {
                                            email: emailInput.trim()
                                        })
                                    }
                                >
                                    Find
                                </button>

                                {foundUser && (
                                    <div className="found-user">
                                        {foundUser.Username}
                                    </div>
                                )}
                            </div>
                        )}

                        <button className="create-confirm" onClick={createRoom}>
                            Create Room
                        </button>
                    </div>
                )}

                {/* ===== ROOM LIST ===== */}
                <div className="room-list">
                    {rooms.map(room => (

                        console.log("ROOM OBJECT:", room),

                        <div
                            key={room._id}
                            className={`room-item ${currentRoom?._id === room._id ? "active" : ""}`}
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
                                    alt="room"
                                    onError={(e) => (e.target.src = DEFAULT_AVATAR)}
                                />
                            </div>

                            <div className="room-info">

                                <div className="room-name">
                                    {room.Room_name}

                                    {unreadRooms[String(room._id)] && (
                                        <span className="notification-dot"></span>
                                    )}
                                </div>

                                <div className="room-actions">
                                    <button
                                        className="room-action-btn menu"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(prev => prev === room._id ? null : room._id);
                                        }}
                                    >
                                        <FaEllipsisV />
                                    </button>

                                    {openMenuId === room._id && (
                                        <div
                                            className="room-dropdown"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {/* 🔥 HIDE (ALL USERS) */}
                                            <div
                                                className="dropdown-item"
                                                onClick={() => {
                                                    hideRoom(room._id);
                                                    setOpenMenuId(null);
                                                }}
                                            >
                                                👁️‍🗨️ Hide chat
                                            </div>

                                            {/* 🔒 ONLY CREATOR */}
                                            {String(room.Creator) === String(myId) && (
                                                <>
                                                    <div
                                                        className="dropdown-item"
                                                        onClick={() => {
                                                            updateRoom(room);
                                                            setOpenMenuId(null);
                                                        }}
                                                    >
                                                        ✏️ Edit
                                                    </div>

                                                    <div
                                                        className="dropdown-item delete"
                                                        onClick={() => {
                                                            deleteRoom(room._id);
                                                            setOpenMenuId(null);
                                                        }}
                                                    >
                                                        🗑 Delete
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    ))}
                </div>

                {/* ===== FOOTER PROFILE ===== */}
                <div className="sidebar-footer">
                    <div className="profile-box" onClick={logout}>
                        <img src={myAvatar} className="profile-avatar" />
                        <div className="profile-name">{myName}</div>

                        <div className="logout-icon"><p>Log out</p></div>
                    </div>
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

                        <div className="my-name">

                            <button
                                className="edit-name-btn action-btn edit"
                                onClick={updateName}
                            >
                                ✎
                            </button>

                            <span className="username">
                                {myName}
                            </span>

                        </div>

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
                                                Authorization: `Bearer ${localStorage.getItem("token")}`
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

                        const previousMsg = messages[index - 1];

                        const showDate =
                            isDifferentDay(
                                msg.Timestamp,
                                previousMsg?.Timestamp
                            );

                        const isMe = String(msg.Sender_id) === String(myId);
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
                                                {msg.Sender_name}
                                            </div>
                                        )}

                                        {/* CONTENT */}
                                        {renderContent(msg)}

                                        {/* ACTIONS (hover mới hiện) */}
                                        {isMe && (
    <div className="message-actions">
        <button
            onClick={() => startEdit(msg)}
            className="icon-btn"
        >
            ✏️
        </button>

        <button
            onClick={() => setDeletingMsg(msg)}
            className="icon-btn delete"
        >
            🗑
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

            {deletingMsg && (
                <div className="modal-overlay">
                    <div className="modal">
                        <p>Delete this message?</p>

                        <div className="modal-actions">
                            <button
                                className="cancel"
                                onClick={() => setDeletingMsg(null)}
                            >
                                Cancel
                            </button>

                            <button
                                className="delete"
                                onClick={() => {
                                    socket.emit("delete_message", {
                                        messageId: deletingMsg._id,
                                        roomId: currentRoom._id
                                    });
                                    setDeletingMsg(null);
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )
            }
        </div>


    ); //return
};

export default Home;