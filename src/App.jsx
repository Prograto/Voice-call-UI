import React, { useState } from "react";
import Sender from "./Sender";
import Receiver from "./Receiver";

function App() {
  const [role, setRole] = useState(null);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Secret Audio Rooms</h1>
      {!role && (
        <>
          <button onClick={() => setRole("sender")}>I am Sender</button>
          <button onClick={() => setRole("receiver")}>I am Receiver</button>
        </>
      )}
      {role === "sender" && <Sender />}
      {role === "receiver" && <Receiver />}
    </div>
  );
}

export default App;
