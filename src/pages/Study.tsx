import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, RotateCw, Check, X, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  mastery_level?: number;
  is_starred?: boolean;
}

const Study = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

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

      // Fetch study progress
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progressData } = await supabase
          .from("study_progress")
          .select("*")
          .eq("user_id", user.id)
          .in("flashcard_id", cardsData.map(c => c.id));

        const progressMap = new Map(
          progressData?.map(p => [p.flashcard_id, p]) || []
        );

        const enrichedCards = cardsData.map(card => ({
          ...card,
          mastery_level: progressMap.get(card.id)?.mastery_level || 0,
          is_starred: progressMap.get(card.id)?.is_starred || false,
        }));

        setFlashcards(enrichedCards);
      } else {
        setFlashcards(cardsData);
      }
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleKnow = async (knows: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const currentCard = flashcards[currentIndex];
      const newMasteryLevel = Math.min((currentCard.mastery_level || 0) + (knows ? 1 : 0), 3);

      const { error } = await supabase
        .from("study_progress")
        .upsert({
          user_id: user.id,
          flashcard_id: currentCard.id,
          mastery_level: newMasteryLevel,
          times_reviewed: (currentCard.mastery_level || 0) + 1,
          times_correct: (knows ? 1 : 0),
          last_studied_at: new Date().toISOString(),
        });

      if (error) throw error;

      if (knows) {
        setStats(prev => ({ ...prev, correct: prev.correct + 1, total: prev.total + 1 }));
      } else {
        setStats(prev => ({ ...prev, total: prev.total + 1 }));
      }

      // Move to next card
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        toast.success(`Study session complete! Score: ${stats.correct + (knows ? 1 : 0)}/${stats.total + 1}`);
        navigate("/");
      }
    } catch (error: any) {
      toast.error("Failed to save progress");
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setStats({ correct: 0, total: 0 });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading flashcards...</p>
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
              Exit Study Mode
            </Button>
            <div className="text-center">
              <h1 className="font-semibold">{setTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} / {flashcards.length}
              </p>
            </div>
            <Button variant="ghost" onClick={handleRestart}>
              <RotateCw className="w-4 h-4 mr-2" />
              Restart
            </Button>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="space-y-6">
          <div className="text-center text-sm text-muted-foreground">
            Score: {stats.correct} / {stats.total}
          </div>

          <div
            className="perspective-1000 cursor-pointer"
            onClick={handleFlip}
          >
            <Card
              className={cn(
                "relative min-h-[400px] p-8 flex items-center justify-center transition-all duration-500 transform-style-preserve-3d shadow-glow",
                isFlipped && "rotate-y-180"
              )}
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden",
                  isFlipped && "invisible"
                )}
              >
                <div className="text-sm text-muted-foreground mb-4">TERM</div>
                <div className="text-3xl font-bold text-center">{currentCard.term}</div>
                <div className="mt-8 text-sm text-muted-foreground">
                  Click to flip
                </div>
              </div>
              <div
                className={cn(
                  "absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden",
                  !isFlipped && "invisible"
                )}
                style={{
                  transform: "rotateY(180deg)",
                }}
              >
                <div className="text-sm text-muted-foreground mb-4">DEFINITION</div>
                <div className="text-2xl text-center">{currentCard.definition}</div>
              </div>
            </Card>
          </div>

          {isFlipped && (
            <div className="flex gap-4 justify-center animate-fade-in">
              <Button
                onClick={() => handleKnow(false)}
                variant="outline"
                size="lg"
                className="flex-1 max-w-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
              >
                <X className="w-5 h-5 mr-2" />
                Don't Know
              </Button>
              <Button
                onClick={() => handleKnow(true)}
                size="lg"
                className="flex-1 max-w-xs bg-success hover:bg-success/90"
              >
                <Check className="w-5 h-5 mr-2" />
                Know
              </Button>
            </div>
          )}

          {currentCard.mastery_level !== undefined && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(level => (
                  <div
                    key={level}
                    className={cn(
                      "w-2 h-2 rounded-full",
                      level < (currentCard.mastery_level || 0)
                        ? "bg-success"
                        : "bg-muted"
                    )}
                  />
                ))}
              </div>
              <span className="text-muted-foreground">
                Mastery Level: {currentCard.mastery_level || 0}/3
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Study;
