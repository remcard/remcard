import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  image_url?: string;
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
  const [typingMode, setTypingMode] = useState(false);
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

      setFlashcards(cardsData);
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (isCorrect: boolean) => {
    if (isCorrect) {
      setCorrectCount(correctCount + 1);
    }
    
    setTimeout(() => {
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
        setUserAnswer("");
      } else {
        toast.success(`Completed! Score: ${correctCount + (isCorrect ? 1 : 0)}/${flashcards.length}`);
        navigate("/");
      }
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
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Exit
            </Button>
            <div className="text-center">
              <h1 className="font-semibold">{setTitle} - Learn Mode</h1>
              <p className="text-sm text-muted-foreground">
                Score: {correctCount} / {currentIndex + 1}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setTypingMode(!typingMode)}>
              {typingMode ? "Multiple Choice" : "Typing Mode"}
            </Button>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <Card className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="text-sm text-muted-foreground">What is the definition?</div>
            <div className="text-3xl font-bold">{currentCard.term}</div>
            {currentCard.image_url && (
              <img 
                src={currentCard.image_url} 
                alt={currentCard.term}
                className="max-w-md mx-auto rounded-lg"
              />
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
                        ? "Correct!"
                        : "Incorrect"}
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
