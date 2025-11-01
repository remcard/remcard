import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Study from "./pages/Study";
import SetEditor from "./pages/SetEditor";
import NotFound from "./pages/NotFound";
import HostGame from "./pages/HostGame";
import JoinGame from "./pages/JoinGame";
import GameLobby from "./pages/GameLobby";
import GamePlay from "./pages/GamePlay";
import Settings from "./pages/Settings";
import MatchingGame from "./pages/MatchingGame";
import LearnMode from "./pages/LearnMode";
import TestMode from "./pages/TestMode";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/study/:id" element={<Study />} />
          <Route path="/set/:id/edit" element={<SetEditor />} />
          <Route path="/set/new" element={<SetEditor />} />
          <Route path="/host/:setId" element={<HostGame />} />
          <Route path="/join" element={<JoinGame />} />
          <Route path="/game/lobby/:gameId" element={<GameLobby />} />
          <Route path="/game/play/:gameId" element={<GamePlay />} />
          <Route path="/matching/:id" element={<MatchingGame />} />
          <Route path="/learn/:id" element={<LearnMode />} />
          <Route path="/test/:id" element={<TestMode />} />
          <Route path="/settings" element={<Settings />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
