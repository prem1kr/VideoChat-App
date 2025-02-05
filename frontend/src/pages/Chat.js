import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import io from "socket.io-client";
import SimplePeer from "simple-peer";
import { v4 as uuidv4 } from "uuid";
import "./Chat.css";

const Chat = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [userId, setUserId] = useState(null); // Unique user ID
  const [targetUserId, setTargetUserId] = useState(""); // Target user ID
  const [isConnected, setIsConnected] = useState(false); // Connection status
  const [error, setError] = useState(""); // Error message

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socket = useRef(null);
  const peerConnection = useRef(null);
  const location = useLocation();
  const { matchUserId } = location.state || {};

  useEffect(() => {
    // Generate a unique user ID
    const uniqueId = uuidv4();
    setUserId(uniqueId);

    // Initialize WebSocket connection
    socket.current = io("http://localhost:5000", { transports: ["websocket"] });

    // Register user with the server
    socket.current.emit("register-user", { userId: uniqueId });

    // Handle socket disconnection
    socket.current.on("disconnect", () => {
      console.warn("Socket disconnected. Attempting to reconnect...");
      setIsConnected(false);
    });

    // Handle user not found
    socket.current.on("user-not-found", ({ userId }) => {
      setError(`User ${userId} not found.`);
    });

    // Handle random user found
    socket.current.on("random-user-found", ({ userId }) => {
      setTargetUserId(userId);
      socket.current.emit("join-chat", { userId, senderId: uniqueId });
    });

    // Handle no active users
    socket.current.on("no-active-users", () => {
      setError("No active users found.");
    });

    // Get local media stream (video and audio)
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Auto-connect to a matched user
        if (matchUserId) {
          setTargetUserId(matchUserId);
          socket.current.emit("join-chat", { userId: matchUserId, senderId: uniqueId });
        }
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
      });

    // Handle WebRTC offer
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

    // Handle WebRTC answer
    socket.current.on("answer", async ({ answer }) => {
      try {
        if (peerConnection.current) {
          await peerConnection.current.signal(answer);
        }
      } catch (err) {
        console.error("Error handling answer:", err);
      }
    });

    // Handle ICE candidates
    socket.current.on("ice-candidate", async ({ candidate }) => {
      try {
        if (peerConnection.current) {
          await peerConnection.current.signal(candidate);
        }
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    // Cleanup on component unmount
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
  }, [matchUserId]);

  // Function to create WebRTC connection
  const createPeerConnection = (senderId) => {
    if (peerConnection.current) return; // Prevent duplicate connections

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
      socket.current.emit("answer", { answer: data, targetUserId: senderId, senderId: userId });
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
  };

  // Function to manually connect to a user
  const handleConnectToUser = () => {
    if (!targetUserId || !userId) {
      setError("Target User ID or User ID is missing.");
      return;
    }
    setError(""); // Clear previous errors
    socket.current.emit("join-chat", { userId: targetUserId, senderId: userId });
  };

  // Function to auto-connect with a random user
  const handleAutoConnect = () => {
    if (!userId) {
      setError("User ID is missing.");
      return;
    }
    setError(""); // Clear previous errors
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
      <div className="video-container">
        <video ref={localVideoRef} autoPlay muted className="local-video" />
        <video ref={remoteVideoRef} autoPlay className="remote-video" />
      </div>
    </div>
  );
};

export default Chat;