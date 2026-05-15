import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// When deployed to Vercel (or any static host), point the API client at the
// separately-hosted backend.  Leave unset for local / Replit dev where the
// shared reverse-proxy routes /api/* to the API server automatically.
const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
if (apiUrl) setBaseUrl(apiUrl);

createRoot(document.getElementById("root")!).render(<App />);
