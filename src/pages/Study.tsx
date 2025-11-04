import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RotateCw, ArrowRight, Play, Pause, Shuffle, Star, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Flashcard {
  id: string;
  term: string;
  definition: string;
  image_url?: string;
  is_starred?: boolean;
}

const Study = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [setTitle, setSetTitle] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [displayedCards, setDisplayedCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [showTermFirst, setShowTermFirst] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchSetAndCards();
  }, [id]);

  useEffect(() => {
    if (isAutoPlay && !isFlipped) {
      const timer = setTimeout(() => {
        handleNext();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAutoPlay, currentIndex, isFlipped]);

  useEffect(() => {
    filterCards();
  }, [starredOnly]); // Removed flashcards dependency to prevent reset on star toggle

  const fetchSetAndCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);

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

      // Fetch starred status if user is logged in
      if (user) {
        const { data: progressData } = await supabase
          .from("study_progress")
          .select("flashcard_id, is_starred")
          .eq("user_id", user.id)
          .in("flashcard_id", cardsData.map(c => c.id));

        const starredMap = new Map(progressData?.map(p => [p.flashcard_id, p.is_starred]) || []);
        const cardsWithStars = cardsData.map(card => ({
          ...card,
          is_starred: starredMap.get(card.id) || false
        }));
        setFlashcards(cardsWithStars);
        setDisplayedCards(cardsWithStars);
        setCurrentIndex(0);
      } else {
        setFlashcards(cardsData);
        setDisplayedCards(cardsData);
        setCurrentIndex(0);
      }
    } catch (error: any) {
      toast.error("Failed to load flashcards");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const filterCards = () => {
    const prevCardId = displayedCards[currentIndex]?.id;

    // Build the new displayed list based on filter
    const starred = flashcards.filter((c) => c.is_starred);
    const newDisplayed = starredOnly ? (starred.length > 0 ? starred : flashcards) : flashcards;

    // Find previous card in new list (if it exists)
    let nextIndex = 0;
    if (prevCardId) {
      const idxInNew = newDisplayed.findIndex((c) => c.id === prevCardId);
      nextIndex = idxInNew !== -1 ? idxInNew : 0;
    }

    // Apply list and clamp index to range
    setDisplayedCards(newDisplayed);
    setCurrentIndex(Math.min(nextIndex, Math.max(newDisplayed.length - 1, 0)));
  };

  const handleShuffle = () => {
    const shuffled = [...displayedCards].sort(() => Math.random() - 0.5);
    setDisplayedCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    toast.success("Cards shuffled!");
  };

  const toggleStar = async () => {
    if (!userId) {
      toast.error("Please log in to star cards");
      return;
    }

    const currentCard = displayedCards[currentIndex];
    const newStarredState = !currentCard.is_starred;

    try {
      const { data: existingProgress } = await supabase
        .from("study_progress")
        .select("id")
        .eq("user_id", userId)
        .eq("flashcard_id", currentCard.id)
        .maybeSingle();

      if (existingProgress) {
        await supabase
          .from("study_progress")
          .update({ is_starred: newStarredState })
          .eq("id", existingProgress.id);
      } else {
        await supabase
          .from("study_progress")
          .insert({
            user_id: userId,
            flashcard_id: currentCard.id,
            is_starred: newStarredState
          });
      }

      // Update local state without re-filtering
      const updatedFlashcards = flashcards.map(c => 
        c.id === currentCard.id ? { ...c, is_starred: newStarredState } : c
      );
      const updatedDisplayed = displayedCards.map(c => 
        c.id === currentCard.id ? { ...c, is_starred: newStarredState } : c
      );
      
      setFlashcards(updatedFlashcards);
      setDisplayedCards(updatedDisplayed);

      toast.success(newStarredState ? "Card starred!" : "Star removed");
    } catch (error) {
      toast.error("Failed to update star");
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    if (currentIndex < displayedCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      toast.success("You've completed this set!");
      navigate("/");
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading flashcards...</p>
      </div>
    );
  }

  const currentCard = displayedCards[currentIndex];
  const progress = ((currentIndex + 1) / displayedCards.length) * 100;

  if (!currentCard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No cards available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
                <SettingsIcon className="w-4 h-4" />
              </Button>
              <Button variant="ghost" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit
              </Button>
            </div>
            <div className="text-center flex-1">
              <h1 className="font-semibold">{setTitle}</h1>
              <p className="text-sm text-muted-foreground">
                {currentIndex + 1} / {displayedCards.length}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setIsAutoPlay(!isAutoPlay)}>
                {isAutoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleShuffle}>
                <Shuffle className="w-4 h-4" />
              </Button>
              <Button variant="ghost" onClick={handleRestart}>
                <RotateCw className="w-4 h-4 mr-2" />
                Restart
              </Button>
            </div>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="space-y-6">
          <div className="flex justify-between items-center p-4 bg-card rounded-lg border">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={showTermFirst}
                  onCheckedChange={(checked) => {
                    setShowTermFirst(checked);
                    setIsFlipped(false);
                  }}
                  id="term-first"
                />
                <Label htmlFor="term-first" className="cursor-pointer">
                  Show {showTermFirst ? "Term" : "Definition"} First
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={starredOnly}
                  onCheckedChange={setStarredOnly}
                  id="starred-only"
                />
                <Label htmlFor="starred-only" className="cursor-pointer">
                  Starred Only
                </Label>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleStar}
              className={cn(currentCard?.is_starred && "text-warning")}
            >
              <Star className={cn("w-5 h-5", currentCard?.is_starred && "fill-current")} />
            </Button>
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
                <div className="text-sm text-muted-foreground mb-4">
                  {showTermFirst ? "TERM" : "DEFINITION"}
                </div>
                {currentCard && currentCard.image_url && showTermFirst && (
                  <img 
                    src={currentCard.image_url} 
                    alt={currentCard?.term || 'Flashcard image'}
                    className="max-w-sm mb-4 rounded-lg"
                  />
                )}
                <div className="text-3xl font-bold text-center">
                  {showTermFirst ? currentCard.term : currentCard.definition}
                </div>
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
                <div className="text-sm text-muted-foreground mb-4">
                  {showTermFirst ? "DEFINITION" : "TERM"}
                </div>
                {currentCard && currentCard.image_url && !showTermFirst && (
                  <img 
                    src={currentCard.image_url} 
                    alt={currentCard?.term || 'Flashcard image'}
                    className="max-w-sm mb-4 rounded-lg"
                  />
                )}
                <div className="text-2xl text-center">
                  {showTermFirst ? currentCard.definition : currentCard.term}
                </div>
              </div>
            </Card>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              onClick={handlePrevious}
              size="lg"
              variant="outline"
              disabled={currentIndex === 0}
              className="transition-all duration-200 hover:scale-105"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Previous
            </Button>
            <Button
              onClick={handleNext}
              size="lg"
              className="bg-gradient-primary hover:opacity-90 transition-all duration-200 hover:scale-105 px-8"
            >
              {currentIndex < displayedCards.length - 1 ? (
                <>
                  Next Card
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                "Complete"
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Study;
