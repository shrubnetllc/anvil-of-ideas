import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { loadGTM } from './lib/gtm';

loadGTM();

createRoot(document.getElementById("root")!).render(<App />);
