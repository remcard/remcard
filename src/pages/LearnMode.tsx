import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, X, Shuffle, Settings2, Lightbulb, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  image_url?: string;
  confidence?: number; // 0-100 tracking confidence
  lastSeen?: number; // timestamp
}

const LearnMode = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [typingMode, setTypingMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHints, setShowHints] = useState(true);
  const [showImages, setShowImages] = useState(true);
  const [spacedRepetition, setSpacedRepetition] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

  const fetchSetAndCards = async () => {
    try {
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("title")
        .eq("id", id)
        .maybeSingle();

      if (setError) throw setError;
      if (!setData) {
        toast.error("Set not found");
        navigate("/");
        return;
      }
      
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

      const cardsWithMetrics = cardsData.map(card => ({
        ...card,
        confidence: 50,
        lastSeen: Date.now()
      }));

      setFlashcards(cardsWithMetrics);
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentIndex(0);
    setShowAnswer(false);
    toast.success("Cards shuffled!");
  };

  const updateConfidence = (correct: boolean) => {
    const updated = [...flashcards];
    const current = updated[currentIndex];
    
    // Adaptive algorithm: increase confidence by 15-20 for correct, decrease by 20-30 for wrong
    if (correct) {
      current.confidence = Math.min(100, (current.confidence || 50) + 20);
      setStreak(streak + 1);
    } else {
      current.confidence = Math.max(0, (current.confidence || 50) - 25);
      setStreak(0);
    }
    
    current.lastSeen = Date.now();
    setFlashcards(updated);
  };

  const getNextCard = () => {
    if (!spacedRepetition) {
      return (currentIndex + 1) % flashcards.length;
    }

    // Spaced repetition: prioritize cards with low confidence
    const sortedByConfidence = flashcards
      .map((card, idx) => ({ card, idx, confidence: card.confidence || 50 }))
      .sort((a, b) => a.confidence - b.confidence);

    // Pick from bottom 40% of confidence
    const lowConfidencePool = sortedByConfidence.slice(0, Math.max(1, Math.floor(flashcards.length * 0.4)));
    const next = lowConfidencePool[Math.floor(Math.random() * lowConfidencePool.length)];
    
    return next.idx;
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) {
      setCorrectCount(correctCount + 1);
    }

    updateConfidence(isCorrect);
    
    setTimeout(() => {
      const nextIdx = getNextCard();
      setCurrentIndex(nextIdx);
      setShowAnswer(false);
      setUserAnswer("");
    }, 1000);
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    setShowAnswer(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const avgConfidence = Math.round(flashcards.reduce((sum, c) => sum + (c.confidence || 50), 0) / flashcards.length);
  const progress = avgConfidence;

  const getHint = (text: string) => {
    const words = text.split(' ');
    if (words.length === 1) return text[0] + '...';
    return words.map(w => w[0]).join(' ') + '...';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-center flex-1">
              <h1 className="font-semibold">{setTitle} - Learn Mode</h1>
              <p className="text-sm text-muted-foreground">
                Confidence: {avgConfidence}% • Streak: {streak} 🔥
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={handleShuffle}>
                <Shuffle className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
                <Settings2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {showSettings && (
          <Card className="p-6 mb-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              Learning Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="typing">Typing Mode</Label>
                <Switch checked={typingMode} onCheckedChange={setTypingMode} id="typing" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hints">Show Hints</Label>
                <Switch checked={showHints} onCheckedChange={setShowHints} id="hints" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="images">Show Images</Label>
                <Switch checked={showImages} onCheckedChange={setShowImages} id="images" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="spaced">Spaced Repetition</Label>
                <Switch checked={spacedRepetition} onCheckedChange={setSpacedRepetition} id="spaced" />
              </div>
            </div>
          </Card>
        )}

        <Card className="p-8 space-y-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Card Confidence: {currentCard.confidence || 50}%</span>
            <span className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              Active Learning
            </span>
          </div>

          <div className="text-center space-y-4">
            <div className="text-sm text-muted-foreground">What is the definition?</div>
            <div className="text-3xl font-bold">{currentCard.term}</div>
            {showImages && currentCard.image_url && (
              <img 
                src={currentCard.image_url} 
                alt={currentCard.term}
                className="max-w-md mx-auto rounded-lg"
              />
            )}
            {showHints && !showAnswer && (
              <div className="text-muted-foreground italic flex items-center justify-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Hint: {getHint(currentCard.definition)}
              </div>
            )}
          </div>

          {!typingMode ? (
            <div className="space-y-3">
              {!showAnswer ? (
                <Button
                  onClick={() => setShowAnswer(true)}
                  className="w-full"
                  size="lg"
                >
                  Show Answer
                </Button>
              ) : (
                <>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <div className="text-lg">{currentCard.definition}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => handleAnswer(false)}
                      variant="outline"
                      size="lg"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Still Learning
                    </Button>
                    <Button
                      onClick={() => handleAnswer(true)}
                      size="lg"
                      className="bg-success hover:bg-success/90"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      Got It!
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Input
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Type your answer..."
                className="text-lg"
                disabled={showAnswer}
              />
              {!showAnswer ? (
                <Button onClick={handleSubmit} className="w-full" size="lg">
                  Submit
                </Button>
              ) : (
                <>
                  <div className={cn(
                    "p-4 rounded-lg text-center",
                    userAnswer.toLowerCase().trim() === currentCard.definition.toLowerCase().trim()
                      ? "bg-success/20 text-success"
                      : "bg-destructive/20 text-destructive"
                  )}>
                    <div className="font-semibold mb-2">
                      {userAnswer.toLowerCase().trim() === currentCard.definition.toLowerCase().trim()
                        ? "Correct! ✨"
                        : "Not quite"}
                    </div>
                    <div className="text-sm">Correct answer: {currentCard.definition}</div>
                  </div>
                  <Button
                    onClick={() => handleAnswer(
                      userAnswer.toLowerCase().trim() === currentCard.definition.toLowerCase().trim()
                    )}
                    className="w-full"
                    size="lg"
                  >
                    Continue
                  </Button>
                </>
              )}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default LearnMode;
