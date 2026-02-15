// Polyfill EventEmitter for @metamask/sdk before any other imports
import EventEmitter from "events";
if (typeof (globalThis as any).EventEmitter === "undefined") {
  (globalThis as any).EventEmitter = EventEmitter;
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
