import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Trophy, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
}

interface MatchCard {
  id: string;
  text: string;
  type: "term" | "definition";
  flashcardId: string;
  isMatched: boolean;
}

interface LeaderboardEntry {
  player_name: string;
  completion_time_ms: number;
  created_at: string;
}

const MatchingGame = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSetAndCards();
    fetchLeaderboard();
  }, [id]);

  useEffect(() => {
    if (startTime && !isComplete) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 10);
      return () => clearInterval(interval);
    }
  }, [startTime, isComplete]);

  const fetchSetAndCards = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("title")
        .eq("id", id)
        .single();

      if (setError) throw setError;
      setSetTitle(setData.title);

      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcards")
        .select("*")
        .eq("set_id", id)
        .order("position");

      if (cardsError) throw cardsError;

      if (cardsData.length === 0) {
        toast.error("This set has no flashcards");
        navigate("/");
        return;
      }

      setFlashcards(cardsData);
      initializeGame(cardsData);
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from("matching_game_results")
      .select("player_name, completion_time_ms, created_at")
      .eq("flashcard_set_id", id)
      .order("completion_time_ms")
      .limit(10);

    if (data) setLeaderboard(data);
  };

  const initializeGame = (cards: Flashcard[]) => {
    const gameCards: MatchCard[] = [];
    
    cards.forEach(card => {
      gameCards.push({
        id: `term-${card.id}`,
        text: card.term,
        type: "term",
        flashcardId: card.id,
        isMatched: false,
      });
      gameCards.push({
        id: `def-${card.id}`,
        text: card.definition,
        type: "definition",
        flashcardId: card.id,
        isMatched: false,
      });
    });

    // Shuffle cards
    const shuffled = gameCards.sort(() => Math.random() - 0.5);
    setMatchCards(shuffled);
  };

  const handleCardClick = useCallback((cardId: string) => {
    if (!startTime) {
      setStartTime(Date.now());
    }

    const card = matchCards.find(c => c.id === cardId);
    if (!card || card.isMatched) return;

    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter(id => id !== cardId));
      return;
    }

    if (selectedCards.length === 0) {
      setSelectedCards([cardId]);
    } else if (selectedCards.length === 1) {
      const firstCard = matchCards.find(c => c.id === selectedCards[0]);
      const secondCard = card;

      if (firstCard && secondCard.flashcardId === firstCard.flashcardId) {
        // Match!
        const updated = matchCards.map(c => 
          c.flashcardId === firstCard.flashcardId 
            ? { ...c, isMatched: true }
            : c
        );
        setMatchCards(updated);
        setSelectedCards([]);

        // Check if game is complete
        if (updated.every(c => c.isMatched)) {
          completeGame();
        }
      } else {
        // No match
        setTimeout(() => {
          setSelectedCards([]);
        }, 500);
        setSelectedCards([...selectedCards, cardId]);
      }
    }
  }, [matchCards, selectedCards, startTime]);

  const completeGame = async () => {
    if (!startTime) return;
    
    const completionTime = Date.now() - startTime;
    setIsComplete(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from("matching_game_results").insert({
        flashcard_set_id: id,
        user_id: user?.id,
        player_name: user?.user_metadata?.display_name || "Anonymous",
        completion_time_ms: completionTime,
      });

      toast.success("Game complete!");
      fetchLeaderboard();
    } catch (error) {
      console.error("Failed to save result:", error);
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, "0")}s`;
  };

  const restartGame = () => {
    initializeGame(flashcards);
    setSelectedCards([]);
    setStartTime(null);
    setElapsedTime(0);
    setIsComplete(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="text-center">
              <h1 className="font-semibold">{setTitle} - Matching Game</h1>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formatTime(elapsedTime)}</span>
              </div>
            </div>
            <Button variant="ghost" onClick={restartGame}>
              Restart
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {matchCards.map((card) => (
                <Card
                  key={card.id}
                  onClick={() => handleCardClick(card.id)}
                  className={cn(
                    "p-6 cursor-pointer transition-all duration-300 hover:scale-105 hover:-translate-y-1 animate-fade-in",
                    card.isMatched && "opacity-50 cursor-not-allowed bg-success/20 animate-scale-in",
                    selectedCards.includes(card.id) && "ring-4 ring-primary bg-primary/10 scale-105 shadow-glow",
                    !card.isMatched && !selectedCards.includes(card.id) && "hover:shadow-lg hover:shadow-primary/20"
                  )}
                  style={{ animationDelay: `${matchCards.indexOf(card) * 30}ms` }}
                >
                  <p className="text-sm text-center break-words">{card.text}</p>
                </Card>
              ))}
            </div>

            {isComplete && (
              <Card className="mt-6 p-8 text-center bg-gradient-primary text-white animate-scale-in shadow-glow">
                <Trophy className="w-16 h-16 mx-auto mb-4 animate-bounce" />
                <h2 className="text-3xl font-bold mb-2">Congratulations!</h2>
                <p className="text-xl mb-4">You completed it in {formatTime(elapsedTime)}</p>
                <Button onClick={restartGame} variant="secondary" className="mt-4 transition-all duration-200 hover:scale-105">
                  Play Again
                </Button>
              </Card>
            )}
          </div>

          <div>
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Leaderboard</h3>
              </div>
              <div className="space-y-2">
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No scores yet. Be the first!
                  </p>
                ) : (
                  leaderboard.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 rounded bg-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">#{index + 1}</span>
                        <span className="text-sm">{entry.player_name}</span>
                      </div>
                      <span className="text-sm font-mono">
                        {formatTime(entry.completion_time_ms)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MatchingGame;
