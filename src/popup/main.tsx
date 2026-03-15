import React from "react";
import ReactDOM from "react-dom/client";
import PopupComponent from "./Popup";
import "../styles/tailwind.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PopupComponent />
  </React.StrictMode>,
);
