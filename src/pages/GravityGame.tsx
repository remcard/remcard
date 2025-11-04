import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Heart, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
}

interface FallingWord {
  id: string;
  term: string;
  answer: string;
  y: number;
  x: number;
  speed: number;
}

const GravityGame = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [fallingWords, setFallingWords] = useState<FallingWord[]>([]);
  const [userInput, setUserInput] = useState("");
  const [hearts, setHearts] = useState(5);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [showTerms, setShowTerms] = useState(true);

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

  useEffect(() => {
    if (!gameStarted || isGameOver) return;

    const gameLoop = setInterval(() => {
      setFallingWords((prev) => {
        const updated = prev.map((word) => ({
          ...word,
          y: word.y + word.speed,
        }));

        // Check for words that reached the bottom
        const reachedBottom = updated.filter((w) => w.y >= 80);
        if (reachedBottom.length > 0) {
          setHearts((h) => Math.max(0, h - reachedBottom.length));
        }

        return updated.filter((w) => w.y < 80);
      });
    }, 50);

    return () => clearInterval(gameLoop);
  }, [gameStarted, isGameOver]);

  useEffect(() => {
    if (!gameStarted || isGameOver) return;

    const spawnInterval = setInterval(() => {
      if (flashcards.length > 0) {
        const randomCard = flashcards[Math.floor(Math.random() * flashcards.length)];
        const newWord: FallingWord = {
          id: `${randomCard.id}-${Date.now()}`,
          term: showTerms ? randomCard.term : randomCard.definition,
          answer: showTerms ? randomCard.definition : randomCard.term,
          y: -10,
          x: 10 + Math.random() * 80,
          speed: 0.5 + Math.random() * 0.5,
        };
        setFallingWords((prev) => [...prev, newWord]);
      }
    }, 2000);

    return () => clearInterval(spawnInterval);
  }, [flashcards, gameStarted, isGameOver]);

  useEffect(() => {
    if (hearts <= 0 && gameStarted) {
      setIsGameOver(true);
      toast.error("Game Over!");
    }
  }, [hearts, gameStarted]);

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
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!userInput.trim()) return;

    const matchedWord = fallingWords.find(
      (word) =>
        word.answer.toLowerCase().trim() === userInput.toLowerCase().trim()
    );

    if (matchedWord) {
      setFallingWords((prev) => prev.filter((w) => w.id !== matchedWord.id));
      setScore((s) => s + Math.round((80 - matchedWord.y) * 10));
      toast.success("Correct! +points");
      setUserInput("");
    } else {
      toast.error("No match found");
      setUserInput("");
    }
  };

  const startGame = (mode: boolean) => {
    setShowTerms(mode);
    setGameStarted(true);
    setHearts(5);
    setScore(0);
    setIsGameOver(false);
    setFallingWords([]);
  };

  const restartGame = () => {
    setGameStarted(false);
    setHearts(5);
    setScore(0);
    setIsGameOver(false);
    setFallingWords([]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading game...</p>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-2xl w-full space-y-6 animate-fade-in">
          <div className="text-center space-y-4">
            <Zap className="w-16 h-16 mx-auto text-primary animate-pulse" />
            <h2 className="text-4xl font-bold">Gravity Game</h2>
            <p className="text-xl text-muted-foreground">{setTitle}</p>
            <div className="text-left space-y-2 bg-muted p-6 rounded-lg">
            <h3 className="font-semibold text-lg">How to Play:</h3>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Words fall from the top of the screen</li>
                <li>Type the correct answer before they hit the bottom</li>
                <li>You have 5 hearts - lose one for each word that falls</li>
                <li>Score more points by answering quickly!</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-lg text-center">Choose what falls:</h3>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => startGame(true)} className="w-full" size="lg" variant="default">
                  Terms Fall
                  <p className="text-xs mt-1 opacity-80">(Type definitions)</p>
                </Button>
                <Button onClick={() => startGame(false)} className="w-full" size="lg" variant="secondary">
                  Definitions Fall
                  <p className="text-xs mt-1 opacity-80">(Type terms)</p>
                </Button>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/")} className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (isGameOver) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-2xl w-full space-y-6 text-center animate-scale-in">
          <h2 className="text-4xl font-bold">Game Over!</h2>
          <div className="text-6xl font-bold text-primary">{score}</div>
          <div className="text-xl text-muted-foreground">Final Score</div>
          <div className="flex gap-4 justify-center">
            <Button onClick={restartGame} size="lg" className="transition-all duration-200 hover:scale-105">
              Play Again
            </Button>
            <Button variant="outline" onClick={() => navigate("/")} size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-center flex-1">
              <h1 className="font-semibold">{setTitle} - Gravity Game</h1>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-destructive fill-current" />
                <span className="font-bold text-lg">{hearts}</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-warning fill-current" />
                <span className="font-bold text-lg">{score}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative h-[calc(100vh-80px)] container mx-auto px-4">
        <div className="relative h-full">
          {fallingWords.map((word) => (
            <div
              key={word.id}
              className="absolute transition-all animate-fade-in"
              style={{
                top: `${word.y}%`,
                left: `${word.x}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <Card className="p-4 bg-gradient-primary text-white font-bold text-xl shadow-glow whitespace-nowrap">
                {word.term}
              </Card>
            </div>
          ))}
        </div>

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
          <Card className="p-6 bg-card/95 backdrop-blur-md shadow-lg">
            <div className="flex gap-4">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Type the definition..."
                className="text-lg"
                autoFocus
              />
              <Button
                onClick={handleSubmit}
                size="lg"
                disabled={!userInput.trim()}
                className="transition-all duration-200 hover:scale-105"
              >
                Submit
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default GravityGame;
