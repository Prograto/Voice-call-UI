import React, { useState, useRef } from "react";
import socket from "./socket";

export default function Sender() {
  const [room, setRoom] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);

  const localStream = useRef(null);
  const pcs = useRef({});
  const pendingCandidates = useRef({});
  const pendingOffers = useRef({}); // track if an offer is pending

  // Get microphone stream once
  const initLocalStream = async () => {
    if (!localStream.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.current = stream;
      } catch (e) {
        alert("Microphone access denied: " + e.message);
      }
    }
    return localStream.current;
  };

  const createRoom = () => {
    if (!room.trim()) return alert("Enter room code");
    socket.emit("create-room", { room });
  };

  socket.on("room-created", (res) => {
    if (res.ok) setStatus(`Room ${room} created. Waiting for receivers...`);
    else setStatus("Error: " + res.error);
  });

  socket.on("new-receiver", async ({ receiverId }) => {
    if (pcs.current[receiverId]) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcs.current[receiverId] = pc;
    pendingCandidates.current[receiverId] = [];
    pendingOffers.current[receiverId] = false;

    // Add tracks once
    const stream = await initLocalStream();
    if (stream) stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit("ice-candidate", { target: receiverId, candidate: e.candidate });
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      pendingOffers.current[receiverId] = true;
      socket.emit("offer", { target: receiverId, offer });
    } catch (e) {
      console.error("Error creating offer:", e);
    }
  });

  socket.on("answer", async ({ from, answer }) => {
    const pc = pcs.current[from];
    if (!pc || !pendingOffers.current[from]) return;

    // Only set remote description if PC is waiting for answer
    if (pc.signalingState !== "have-local-offer") {
      console.warn("Answer ignored, signalingState:", pc.signalingState);
      return;
    }

    try {
      await pc.setRemoteDescription(answer);
      pendingOffers.current[from] = false;

      if (pendingCandidates.current[from]) {
        for (const c of pendingCandidates.current[from]) {
          try { await pc.addIceCandidate(c); } catch(e) { console.warn(e); }
        }
        pendingCandidates.current[from] = [];
      }

      setStatus("Connected to receiver");
    } catch (e) {
      console.error("Failed to set remote description:", e, pc.signalingState);
    }
  });

  socket.on("ice-candidate", async ({ from, candidate }) => {
    const pc = pcs.current[from];
    if (!pc) return;

    if (!pc.remoteDescription || !pc.remoteDescription.type) {
      if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
      pendingCandidates.current[from].push(candidate);
    } else {
      try { await pc.addIceCandidate(candidate); } catch (e) { console.warn(e); }
    }
  });

  const toggleSend = async () => {
    const stream = await initLocalStream();
    if (!stream) return;

    const sending = !isSending;
    setIsSending(sending);

    if (sending) {
      setStatus("Sending audio...");
      stream.getTracks().forEach(track => track.enabled = true);
    } else {
      setStatus("Stopped sending.");
      stream.getTracks().forEach(track => track.enabled = false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Sender</h2>
      <input value={room} onChange={e => setRoom(e.target.value)} placeholder="Room code" />
      <button onClick={createRoom}>Create Room</button>
      <button onClick={toggleSend}>{isSending ? "Stop" : "Start"} Sending</button>
      <p>{status}</p>
    </div>
  );
}
