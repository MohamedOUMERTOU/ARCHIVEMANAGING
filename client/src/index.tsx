import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { SEContextProvider } from "./context/SEContext";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <SEContextProvider>
      <App />
    </SEContextProvider>
  </React.StrictMode>,
);
