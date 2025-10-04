import React, { useState, useRef } from "react";
import socket from "./socket";

export default function Receiver() {
  const [room, setRoom] = useState("");
  const [status, setStatus] = useState("");
  const audioRef = useRef(null);
  const pcs = useRef({});
  const pendingCandidates = useRef({});

  const joinRoom = () => {
    if (!room.trim()) return alert("Enter a room code");
    socket.emit("join-room", { room });
  };

  socket.on("room-joined", res => {
    if (res.ok) setStatus("Joined room. Waiting for audio...");
    else setStatus("Error: " + res.error);
  });

  socket.on("offer", async ({ from, offer }) => {
    if (pcs.current[from]) return;

    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcs.current[from] = pc;
    pendingCandidates.current[from] = [];

    pc.ontrack = e => {
      if (!audioRef.current) {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.controls = true;
        audio.srcObject = e.streams[0];
        document.body.appendChild(audio);
        audioRef.current = audio;
      } else audioRef.current.srcObject = e.streams[0];
    };

    pc.onicecandidate = e => {
      if (e.candidate) socket.emit("ice-candidate", { target: from, candidate: e.candidate });
    };

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { target: from, answer });

      // flush pending ICE
      for (const c of pendingCandidates.current[from]) {
        try { await pc.addIceCandidate(c); } catch(e) { console.warn(e); }
      }
      pendingCandidates.current[from] = [];
      setStatus("Connected to sender.");
    } catch (e) {
      console.warn("Error handling offer:", e);
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

  socket.on("sender-left", () => {
    setStatus("Sender ended the session.");
    if (audioRef.current) audioRef.current.remove();
    pcs.current = {};
  });

  return (
    <div style={{ padding: "20px" }}>
      <h2>Receiver</h2>
      <input value={room} onChange={e => setRoom(e.target.value)} placeholder="Room code" />
      <button onClick={joinRoom}>Join Room</button>
      <p>{status}</p>
    </div>
  );
}
