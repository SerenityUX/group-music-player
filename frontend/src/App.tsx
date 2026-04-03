import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Start from "./pages/Start";
import Join from "./pages/Join";
import Party from "./pages/Party";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start" element={<Start />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:partyId" element={<Join />} />
        <Route path="/party/:partyId" element={<Party />} />
      </Routes>
    </BrowserRouter>
  );
}
