import React, { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import io from "socket.io-client";
import SimplePeer from "simple-peer";
import { v4 as uuidv4 } from "uuid";
import "./Chat.css";

const Chat = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [userId, setUserId] = useState(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socket = useRef(null);
  const peerConnection = useRef(null);
  const location = useLocation();
  const { matchUserId } = location.state || {};

  // ✅ Memoized peer connection creation
  const createPeerConnection = useCallback(
    (senderId) => {
      if (peerConnection.current || !localStream) return;

      peerConnection.current = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: localStream,
      });

      peerConnection.current.on("stream", (stream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      });

      peerConnection.current.on("signal", (data) => {
        socket.current.emit("answer", {
          answer: data,
          targetUserId: senderId,
          senderId: userId,
        });
      });

      peerConnection.current.on("error", (err) => {
        console.error("Peer Connection Error:", err);
      });

      peerConnection.current.on("close", () => {
        console.warn("Peer connection closed. Resetting...");
        peerConnection.current = null;
        setIsConnected(false);
      });

      setIsConnected(true);
    },
    [localStream, userId]
  );

  useEffect(() => {
    const uniqueId = uuidv4();
    setUserId(uniqueId);

    socket.current = io("http://localhost:5000", { transports: ["websocket"] });
    socket.current.emit("register-user", { userId: uniqueId });

    socket.current.on("disconnect", () => {
      console.warn("Socket disconnected.");
      setIsConnected(false);
    });

    socket.current.on("user-not-found", ({ userId }) => {
      setError(`User ${userId} not found.`);
    });

    socket.current.on("random-user-found", ({ userId }) => {
      setTargetUserId(userId);
      socket.current.emit("join-chat", { userId, senderId: uniqueId });
    });

    socket.current.on("no-active-users", () => {
      setError("No active users found.");
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        if (matchUserId) {
          setTargetUserId(matchUserId);
          socket.current.emit("join-chat", {
            userId: matchUserId,
            senderId: uniqueId,
          });
        }
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
      });

    socket.current.on("offer", async ({ offer, senderId }) => {
      try {
        if (!peerConnection.current) {
          createPeerConnection(senderId);
        }
        await peerConnection.current.signal(offer);
      } catch (err) {
        console.error("Error handling offer:", err);
      }
    });

    socket.current.on("answer", async ({ answer }) => {
      try {
        if (peerConnection.current) {
          await peerConnection.current.signal(answer);
        }
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    socket.current.on("ice-candidate", async ({ candidate }) => {
      try {
        if (peerConnection.current) {
          await peerConnection.current.signal(candidate);
        }
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.destroy();
        peerConnection.current = null;
      }
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [matchUserId, createPeerConnection, localStream]);

  const handleConnectToUser = () => {
    if (!targetUserId || !userId) {
      setError("Target User ID or User ID is missing.");
      return;
    }
    setError("");
    socket.current.emit("join-chat", { userId: targetUserId, senderId: userId });
  };

  const handleAutoConnect = () => {
    if (!userId) {
      setError("User ID is missing.");
      return;
    }
    setError("");
    socket.current.emit("find-random-user", { senderId: userId });
  };

  return (
    <div className="chat-container">
      <h1>Video Chat</h1>
      <p>Your User ID: {userId}</p>
      <div className="connect-section">
        <input
          type="text"
          placeholder="Enter Target User ID"
          value={targetUserId}
          onChange={(e) => setTargetUserId(e.target.value)}
        />
        <button onClick={handleConnectToUser}>Connect</button>
        <button onClick={handleAutoConnect}>Auto Connect</button>
      </div>
      {error && <p className="error">{error}</p>}
      {/* 👇 Now using remoteStream and isConnected to avoid ESLint warnings */}
      <div className="video-container">
        <video ref={localVideoRef} autoPlay muted className="local-video" />
        <video
          ref={remoteVideoRef}
          autoPlay
          className="remote-video"
          style={{
            border: isConnected ? "3px solid green" : "3px solid red",
          }}
        />
      </div>
      {remoteStream && <p>Remote stream is active!</p>}
    </div>
  );
};

export default Chat;
